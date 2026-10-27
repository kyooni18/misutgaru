/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Exercise the actual Vue visitor component with controlled child/service stubs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium, expect } from '@playwright/test';
import { munPlugin } from '@mun/vite';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
const stubs = {
  'misskey-js': 'export {}',
  '@/components/MkButton.vue': 'export default {template:"<button><slot/></button>"}',
  '@/components/MkStreamingNotesTimeline.vue': 'export default {template:"<div/>"}',
  '@/components/MkInfo.vue': 'export default {template:"<div><slot/></div>"}',
  '@/components/MkVisitorDashboard.ActiveUsersChart.vue': 'export default {template:"<div/>"}',
  '@/os.js': 'export const popup=()=>({dispose(){}})',
  '@/components/MkSigninDialog.vue': 'export default {}',
  '@/components/MkSignupDialog.vue': 'export default {}',
  '@/ui/_common_/common.js': 'export const openInstanceMenu=()=>{}',
  '@@/js/config.js': 'export const instanceName="Test server"',
  '@/instance.js': 'export const instance={iconUrl:null,description:"",disableRegistration:false,federation:"all",policies:{ltlAvailable:false},clientOptions:{showActivitiesForVisitor:!location.search.includes("disabled")}}',
  '@/i18n.js': 'export const i18n={ts:{users:"ユーザー",notes:"ノート",headlineMisskey:"Hello",joinThisServer:"Join",exploreOtherServers:"Other",login:"Login"}}',
  '@/utility/misskey-api.js': 'export const misskeyApi=async (endpoint,data)=>{window.referenceCalls.push([endpoint,data]);return {originalUsersCount:1234,originalNotesCount:56789}}',
  '@/filters/number.js': 'export default n=>new Intl.NumberFormat("ja-JP").format(n)',
};
const vueEntry = `import {createApp} from 'vue';
import Dashboard from '/@fs/${frontend}src/components/MkVisitorDashboard.vue';
import NumberView from '/@fs/${frontend}src/components/MkNumber.vue';
window.referenceCalls=[]; const app=createApp(Dashboard); app.component('MkNumber',NumberView); app.component('MkA',{template:'<a><slot/></a>'}); app.mount('#app');`;
const plugin = {
  name: 'visitor-vue-fixture', enforce: 'pre',
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/__vue') return next();
    res.setHeader('content-type', 'text/html'); res.end('<div id="app"></div><script type="module" src="/__vue-entry.js"></script>');
  }); },
  resolveId(id) { if (id === '@/components/MkNumber.vue') return frontend + 'src/components/MkNumber.vue'; if (id === '/__vue-entry.js') return '\0visitor-vue-entry'; if (Object.hasOwn(stubs, id)) return '\0visitor:' + id; },
  load(id) { if (id === '\0visitor-vue-entry') return vueEntry; if (id.startsWith('\0visitor:')) return stubs[id.slice(9)]; },
};

test('native visitor stats match Vue dashboard requests, labels and counts', async () => {
  const server = await createServer({ root: appRoot, configFile: false, plugins: [plugin, munPlugin(), vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [appRoot, frontend, process.env.MUN_ROOT ?? fileURLToPath(new URL('../../../Mun/', import.meta.url))] } } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('lang', 'ja-JP'));
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/meta', route => route.fulfill({ json: { name: 'Test server', clientOptions: {} } }));
    await page.route('**/assets/locales/**', route => route.fulfill({ json: { users: 'ユーザー', notes: 'ノート' } }));
    const calls = [];
    await page.route('**/api/stats', route => { calls.push(['stats', route.request().postDataJSON()]); return route.fulfill({ json: { originalUsersCount: 1234, originalNotesCount: 56789 } }); });
    await page.goto(url + '/__vue');
    await page.addStyleTag({ content: ':root{--MI_THEME-panel:white;--MI_THEME-fg:#252a30;--MI_THEME-accent:#86b850;--MI-radius:12px}body{font:16px system-ui,sans-serif;color:#252a30}#app{width:430px}' });
    await expect(page.getByText('1,234', { exact: true })).toBeVisible();
    await expect(page.getByText('56,789', { exact: true })).toBeVisible();
    const reference = await page.evaluate(() => ({ labels: [...document.querySelectorAll('[class*="statsItemLabel"]')].map(x => x.textContent), counts: [...document.querySelectorAll('[class*="statsItemCount"]')].map(x => x.textContent), calls: window.referenceCalls }));
    const visual = async item => item.evaluate(el => {
      const style = element => { const c = getComputedStyle(element); return { width: c.width, padding: c.padding, color: c.color, background: c.backgroundColor, radius: c.borderRadius, size: c.fontSize, weight: c.fontWeight }; };
      return { card: style(el), label: style(el.children[0]), count: style(el.children[1]) };
    });
    const referenceStyle = await visual(page.locator('[class*="statsItem_"]').first());
    await page.goto(url + '/');
    await expect(page.locator('.visitor-stats-item').nth(0)).toHaveText('ユーザー1,234');
    await expect(page.locator('.visitor-stats-item').nth(1)).toHaveText('ノート56,789');
    const native = await page.evaluate(() => ({ labels: [...document.querySelectorAll('.visitor-stats-label')].map(x => x.textContent), counts: [...document.querySelectorAll('.visitor-stats-count')].map(x => x.textContent) }));
    assert.deepEqual({ ...native, calls }, reference);
    assert.deepEqual(await visual(page.locator('.visitor-stats-item').first()), referenceStyle);
    await page.goto(url + '/__vue?disabled=1');
    await expect(page.getByText('ユーザー', { exact: true })).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.referenceCalls), []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
