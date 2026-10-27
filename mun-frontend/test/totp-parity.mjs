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

test('native TOTP and backup code step matches Vue input and submission', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const native = fileURLToPath(new URL('../src/components/SigninTotp.mun', import.meta.url));
  const stubs = {
    '@/components/global/MkA.vue': 'export default {}',
    '@/utility/autocomplete.js': 'export class Autocomplete {}',
    '@/utility/id.js': 'export const genId=()=>"fixture-id"',
    '@/theme.js': 'export const themeManager={on(){},off(){}}',
    '@/utility/get-bg-color.js': `export function getBgColor(el){while(el){const color=getComputedStyle(el).backgroundColor;if(color!=='rgba(0, 0, 0, 0)') return color;el=el.parentElement}return null}`,
    'throttle-debounce': 'export const throttle=(_,fn)=>fn; export const debounce=(_,fn)=>fn',
    '@/i18n.js': 'export const i18n={ts:{"2fa":"Two-factor authentication",token:"Token",useTotp:"Use TOTP",useBackupCode:"Use backup code",continue:"Continue"}}',
  };
  const labels = '{"2fa":"Two-factor authentication",token:"Token",useTotp:"Use TOTP",useBackupCode:"Use backup code",continue:"Continue"}';
  const entries = {
    '/vue-entry.js': `import 'icons-subsetter/built/tabler-icons-frontend.css'; import {createApp,h} from 'vue'; import Totp from '/@fs/${frontend}src/components/MkSignin.totp.vue'; import {adaptiveBorderDirective} from '/@fs/${frontend}src/directives/adaptive-border.ts'; window.fixture={submissions:[]}; const app=createApp({render:()=>h(Totp,{onTotpSubmitted:x=>fixture.submissions.push(x)})}); app.directive('adaptive-border',adaptiveBorderDirective); app.mount('#app');`,
    '/mun-entry.js': `import {mount} from '@mun/web'; import {namedArguments} from '@mun/core/compat'; import {SigninTotp} from '/@fs/${native}'; import {createSigninTotpServices} from '/src/services/signin-totp.mjs'; window.fixture={submissions:[]}; const services=createSigninTotpServices({i18n:{ts:${labels}},flow:{submitTotp:x=>fixture.submissions.push(x)}}); window.dispose=mount(SigninTotp(namedArguments({services})),document.querySelector('#app'));`,
  };
  const style = `:root{--MI-margin:16px;--MI_THEME-accent:#86b850;--MI_THEME-accentedBg:#dbeecb;--MI_THEME-fgOnAccent:white;--MI_THEME-fg:#222;--MI_THEME-panel:white;--MI_THEME-divider:#ccc;--MI_THEME-inputBorderHover:#aaa;--MI_THEME-buttonBg:#eee;--MI-hairline:#888;--MI-easeOut:ease-out}body{font:16px system-ui,sans-serif;color:#222;margin:0;background:white}#app{width:336px}._gaps{display:flex;flex-direction:column;gap:var(--MI-margin)}._gaps_s{display:flex;flex-direction:column;gap:10px}._button,._textButton{appearance:none;padding:0;margin:0;background:none;border:none;cursor:pointer;color:inherit;font:inherit;line-height:inherit;max-width:100%;user-select:none}._textButton{color:var(--MI_THEME-accent)}._textButton:not(:disabled):hover{text-decoration:underline}._selectable{user-select:text}*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`;
  const plugin = { name: 'totp-fixture', enforce: 'pre', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url !== '/vue' && req.url !== '/mun') return next(); res.setHeader('content-type', 'text/html'); res.end(`<style>${style}</style><div id="app"></div><script type="module" src="${req.url}-entry.js"></script>`); }); }, resolveId(id) { if (Object.hasOwn(entries, id)) return '\0totp:' + id; if (id === '@/components/MkButton.vue') return frontend + 'src/components/MkButton.vue'; if (id === '@/components/MkInput.vue') return frontend + 'src/components/MkInput.vue'; if (Object.hasOwn(stubs, id)) return '\0totp:' + id; }, load(id) { if (id.startsWith('\0totp:')) { const key = id.slice(6); return entries[key] ?? stubs[key]; } } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, plugins: [plugin, munPlugin(), vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [frontend, fileURLToPath(new URL('..', import.meta.url)), fileURLToPath(new URL('../../packages/icons-subsetter', import.meta.url)), process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun'] } } });
  await server.listen();
  const browserName = process.env.TOTP_BROWSER ?? 'chromium';
  if (!['chromium', 'webkit'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`);
  const browser = await ({ chromium, webkit })[browserName].launch();
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + path);
      try { await page.waitForFunction(() => document.querySelector('input') === document.activeElement, null, { timeout: 3000 }); }
      catch (error) { console.error(path, errors, await page.locator('#app').innerHTML()); throw error; }
      await page.evaluate(() => document.fonts.load('24px "tabler-icons"', '\uea6e\uebd1'));
      await page.waitForFunction(() => document.querySelector('input').style.paddingLeft !== '', null, { timeout: 3000 });
      const input = page.locator('input');
      assert.equal(await input.getAttribute('pattern'), '^[0-9]{6}$');
      assert.equal(await input.getAttribute('inputmode'), 'numeric');
      await input.evaluate(el => el.blur());
      const screenshot = await page.locator('#app').screenshot();
      const metrics = await page.evaluate(() => [...document.querySelectorAll('input,button')].map(el => { const c=getComputedStyle(el), r=el.getBoundingClientRect(); return { text:el.textContent, x:r.x,y:r.y,width:r.width,height:r.height,padding:c.padding,color:c.color,border:c.borderColor,background:c.backgroundColor,font:c.fontSize }; }));
      await input.fill('12345'); await input.press('Enter');
      assert.deepEqual(await page.evaluate(() => fixture.submissions), []);
      await input.fill('123456'); await input.press('Enter');
      assert.deepEqual(await page.evaluate(() => fixture.submissions), ['123456']);
      await page.getByRole('button', { name: 'Use backup code' }).click();
      assert.equal(await input.getAttribute('pattern'), '^[A-Z0-9]{32}$');
      assert.equal(await input.getAttribute('inputmode'), null);
      assert.equal(await input.inputValue(), '123456');
      await input.evaluate(el => el.blur());
      await page.waitForFunction(path => { const prefix=document.querySelector(path === '/mun' ? '.signin-totp-prefix' : '[class*="prefix_"]'); return Math.abs(parseFloat(document.querySelector('input').style.paddingLeft) - prefix.getBoundingClientRect().width) < .02; }, path);
      const backupScreenshot = await page.locator('#app').screenshot();
      await page.getByText('Token (Two-factor authentication)').click();
      assert.equal(await input.evaluate(el => document.activeElement === el), true);
      await input.fill('a'.repeat(32)); await input.press('Enter');
      assert.deepEqual(await page.evaluate(() => fixture.submissions), ['123456']);
      const backup = 'A1'.repeat(16);
      await input.fill(backup); await input.press('Enter');
      assert.deepEqual(await page.evaluate(() => fixture.submissions), ['123456', backup]);
      if (path === '/mun') { await page.evaluate(() => window.dispose()); assert.equal(await page.locator('input').count(), 0); }
      assert.deepEqual(errors, []);
      await page.close(); return { screenshot, backupScreenshot, metrics };
    }
    const native = await exercise('/mun'), reference = await exercise('/vue');
    assert.deepEqual(native.metrics, reference.metrics);
    assert.ok(native.screenshot.equals(reference.screenshot), 'native TOTP screenshot differs from Vue');
    assert.ok(native.backupScreenshot.equals(reference.backupScreenshot), 'native backup-code screenshot differs from Vue');
  } finally { await browser.close(); await server.close(); }
});
