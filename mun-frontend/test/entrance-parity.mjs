/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Isolated layout comparison against the real Vue entrance and background views.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium, expect } from '@playwright/test';
import { munPlugin } from '@mun/vite';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
const background = 'https://example.test/background.png';
const stubs = {
  'misskey-js': 'export {}',
  './welcome.timeline.vue': 'export default {template:"<div/>"}',
  '@/components/MkVisitorDashboard.vue': 'export default {template:"<div>Dashboard</div>"}',
  '@/components/MkMarqueeText.vue': 'export default {template:"<div><slot/></div>"}',
  '@/instance.js': `export const instance={backgroundImageUrl:${JSON.stringify(background)}}`,
  '@/utility/misskey-api.js': 'export const misskeyApiGet=async()=>[]',
  '@/utility/media-proxy.js': 'export const getProxiedImageUrl=x=>x',
};
const entry = `import {createApp} from 'vue';
import Classic from '/@fs/${frontend}src/pages/welcome.entrance.classic.vue';
import Simple from '/@fs/${frontend}src/pages/welcome.entrance.simple.vue';
createApp(location.search.includes('simple')?Simple:Classic).mount('#app');`;
const plugin = {
  name: 'entrance-vue-fixture', enforce: 'pre',
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/__vue-entrance') return next();
    res.setHeader('content-type', 'text/html'); res.end('<div id="app"></div><script type="module" src="/__entrance-entry.js"></script>');
  }); },
  resolveId(id) {
    if (id === '/__entrance-entry.js') return '\0entrance-entry';
    if (id === '@/components/MkFeaturedPhotos.vue') return frontend + 'src/components/MkFeaturedPhotos.vue';
    if (id === '/client-assets/misskey.svg') return frontend + 'assets/misskey.svg';
    if (Object.hasOwn(stubs, id)) return '\0entrance:' + id;
  },
  load(id) { if (id === '\0entrance-entry') return entry; if (id.startsWith('\0entrance:')) return stubs[id.slice(10)]; },
};

test('classic and simple entrance decoration follows Vue at desktop and mobile widths', async () => {
  const server = await createServer({ root: appRoot, configFile: false, plugins: [plugin, munPlugin(), vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [appRoot, frontend, process.env.MUN_ROOT ?? fileURLToPath(new URL('../../../Mun/', import.meta.url))] } } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const width of [1440, 400]) for (const mode of ['classic', 'simple']) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.route('https://example.test/**', route => route.abort());
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/meta', route => route.fulfill({ json: { name: 'Test', backgroundImageUrl: background, clientOptions: { entrancePageStyle: mode, showActivitiesForVisitor: false } } }));
      await page.goto(`${origin}/__vue-entrance?${mode}`);
      await page.addStyleTag({ content: ':root{--MI_THEME-accent:#86b850}body{margin:0;font:16px system-ui,sans-serif}' });
      await expect(page.locator('[class*="contents_"]')).toBeAttached();
      const styles = (selector, properties) => page.locator(selector).first().evaluate((el, props) => Object.fromEntries(props.map(prop => [prop, getComputedStyle(el)[prop]])), properties);
      const bg = await styles('[class*="bg_"]', ['position', 'width', 'height', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'pointerEvents']);
      const logo = await styles('[class*="misskey_"]', ['width']);
      const content = await styles('[class*="contents_"]', ['width', 'paddingTop', 'paddingBottom', 'marginLeft']);
      const shape = mode === 'classic' ? await styles('[class*="shape1_"]', ['clipPath', 'backgroundColor', 'pointerEvents']) : null;
      await page.goto(origin + '/');
      await expect(page.getByRole('heading', { name: 'Test', exact: true })).toBeVisible();
      assert.deepEqual(await styles('.entrance-background', Object.keys(bg)), bg, `${mode} ${width} background`);
      assert.deepEqual(await styles('.entrance-logo img', Object.keys(logo)), logo, `${mode} ${width} logo`);
      assert.deepEqual(await styles('.shell', Object.keys(content)), content, `${mode} ${width} content`);
      if (shape) assert.deepEqual(await styles('.entrance-shape-one', Object.keys(shape)), shape, `${mode} ${width} shape`);
      else await expect(page.locator('.entrance-shape')).toHaveCount(0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});
