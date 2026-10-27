/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium, webkit } from '@playwright/test';
import { munPlugin } from '@mun/vite';

test('native animated number follows Vue for initial and overlapping value changes', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const fixture = fileURLToPath(new URL('../../prototypes/mun-number/App.mun', import.meta.url));
  const entry = {
    '/vue-entry.js': `import { createApp, h, ref } from 'vue'; import NumberView from '/@fs/${frontend}src/components/MkNumber.vue'; const value=ref(100); window.change=n=>value.value=n; createApp({render:()=>h(NumberView,{value:value.value})}).mount('#app');`,
    '/mun-entry.js': `import {mount} from '@mun/web'; import App from '/@fs/${fixture}'; window.dispose=mount(App,document.querySelector('#app')); window.change=n=>document.querySelector(n===200?'#two-hundred':'#fifty').click();`,
  };
  const plugin = { name: 'number-reference', enforce: 'pre', configureServer(server) { server.middlewares.use((req, res, next) => { if (!['/vue', '/mun'].includes(req.url)) return next(); res.setHeader('content-type', 'text/html'); res.end(`<div id="app"></div><script type="module" src="${req.url}-entry.js"></script>`); }); }, resolveId(id) { if (Object.hasOwn(entry, id)) return '\0number:' + id; if (id === '@/filters/number.js') return '\0number:filter'; }, load(id) { if (id === '\0number:filter') return 'export default n=>new Intl.NumberFormat("en-US").format(n)'; if (id.startsWith('\0number:')) return entry[id.slice(8)]; } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, resolve: { alias: [{ find: /^@mun\/core\/compat$/, replacement: fileURLToPath(import.meta.resolve('@mun/core/compat')) }, { find: /^@mun\/core$/, replacement: fileURLToPath(import.meta.resolve('@mun/core')) }] }, plugins: [plugin, munPlugin(), vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url)), process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun'] } } });
  await server.listen();
  const browserName = process.env.NUMBER_BROWSER ?? 'chromium';
  if (!['chromium', 'webkit'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`);
  const browser = await ({ chromium, webkit })[browserName].launch();
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function render(path) {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const frames = new Map(); let id = 0;
        window.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
        window.cancelAnimationFrame = key => frames.delete(key);
        window.pendingFrames = () => frames.size;
        window.advance = time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); };
      });
      await page.goto(base + path);
      await page.waitForFunction(() => window.change && document.querySelector('span'));
      const values = [];
      const advance = async time => { await page.evaluate(t => window.advance(t), time); await page.waitForTimeout(0); values.push(await page.locator(path === '/mun' ? 'main span' : '#app span').first().textContent()); };
      const change = async value => { await page.evaluate(n => window.change(n), value); await page.waitForTimeout(0); };
      await advance(0); await advance(250); await advance(500);
      await change(200); await advance(600); await advance(725);
      await change(50); await advance(750); await advance(1000); await advance(1250);
      if (path === '/mun') {
        await change(200);
        assert.ok(await page.evaluate(() => window.pendingFrames() > 0));
        await page.evaluate(() => window.dispose());
        assert.equal(await page.evaluate(() => window.pendingFrames()), 0);
      }
      await page.close();
      return values;
    }
    const reference = await render('/vue');
    assert.deepEqual(reference, ['0', '50', '100', '100', '125', '200', '125', '50']);
    assert.deepEqual(await render('/mun'), reference);
  } finally { await browser.close(); await server.close(); }
});
