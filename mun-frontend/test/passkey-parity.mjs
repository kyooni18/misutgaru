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

test('native passkey step follows Vue layout and prompt state', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const native = fileURLToPath(new URL('../src/components/SigninPasskey.mun', import.meta.url));
  const setup = `window.fixture={calls:[],done:[],fallback:0}; window.fixture.authenticate=options=>{window.fixture.calls.push(options);return new Promise((resolve,reject)=>{window.fixture.resolve=resolve;window.fixture.reject=reject})}; window.addEventListener('unhandledrejection',e=>e.preventDefault());`;
  const stubs = {
    '@simplewebauthn/browser': 'export const startAuthentication=options=>window.fixture.authenticate(options)',
    '@/i18n.js': 'export const i18n={ts:{useSecurityKey:"Use your security key",retry:"Retry",useTotp:"Use TOTP"}}',
    '@/components/global/MkA.vue': 'export default {}',
  };
  const entries = {
    '/vue-entry.js': `${setup} import 'icons-subsetter/built/tabler-icons-frontend.css'; import {createApp,h} from 'vue'; import Passkey from '/@fs/${frontend}src/components/MkSignin.passkey.vue'; const app=createApp({render:()=>h(Passkey,{credentialRequest:{challenge:'test'},isPerformingPasswordlessLogin:location.search.includes('passwordless'),onDone:x=>fixture.done.push(x),onUseTotp:()=>fixture.fallback++})}); app.config.errorHandler=()=>{}; app.mount('#app');`,
    '/mun-entry.js': `${setup} import {mount} from '@mun/web'; import {namedArguments} from '@mun/core/compat'; import {SigninPasskey} from '/@fs/${native}'; const services={labels:{useSecurityKey:'Use your security key',retry:'Retry',useTotp:'Use TOTP'},authenticate:fixture.authenticate,done:x=>fixture.done.push(x),useTotp:()=>fixture.fallback++}; window.dispose=mount(SigninPasskey(namedArguments({credentialRequest:{challenge:'test'},passwordless:location.search.includes('passwordless'),services})),document.querySelector('#app'));`,
  };
  const style = `:root{--MI-margin:16px;--MI_THEME-accent:#86b850;--MI_THEME-accentedBg:#dbeecb;--MI_THEME-fgOnAccent:white;--MI_THEME-buttonBg:#eee;--MI-hairline:#888;--MI-easeOut:ease-out}body{font:16px system-ui,sans-serif;color:#222;margin:0}#app{width:336px}._gaps{display:flex;flex-direction:column;gap:var(--MI-margin)}._gaps_s{display:flex;flex-direction:column;gap:10px}._button{appearance:none;padding:0;margin:0;background:none;border:none;cursor:pointer;color:inherit;font:inherit;line-height:inherit;max-width:100%;user-select:none}._button:disabled{cursor:default}`;
  const plugin = { name: 'passkey-fixture', enforce: 'pre', configureServer(server) { server.middlewares.use((req, res, next) => { const path = req.url?.split('?')[0]; if (path !== '/vue' && path !== '/mun') return next(); res.setHeader('content-type', 'text/html'); res.end(`<style>${style}</style><div id="app"></div><script type="module" src="${path}-entry.js"></script>`); }); }, resolveId(id) { if (Object.hasOwn(entries, id)) return '\0passkey:' + id; if (id === '@/components/MkButton.vue') return frontend + 'src/components/MkButton.vue'; if (Object.hasOwn(stubs, id)) return '\0passkey:' + id; }, load(id) { if (id.startsWith('\0passkey:')) { const key = id.slice(9); return entries[key] ?? stubs[key]; } } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, plugins: [plugin, munPlugin(), vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [frontend, fileURLToPath(new URL('..', import.meta.url)), fileURLToPath(new URL('../../packages/icons-subsetter', import.meta.url)), process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun'] } } });
  await server.listen();
  const browserName = process.env.PASSKEY_BROWSER ?? 'chromium';
  if (!['chromium', 'webkit'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`);
  const browser = await ({ chromium, webkit })[browserName].launch();
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path, passwordless = false) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + path + (passwordless ? '?passwordless=1' : ''));
      await page.waitForFunction(() => window.fixture?.calls.length === 1);
      await page.evaluate(() => document.fonts.load('24px "tabler-icons"', '\uebd1'));
      assert.equal(await page.evaluate(() => document.fonts.check('24px "tabler-icons"', '\uebd1')), true);
      const buttons = page.locator('button');
      assert.equal(await buttons.count(), passwordless ? 1 : 2);
      assert.equal(await buttons.first().isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => fixture.calls[0]), { optionsJSON: { challenge: 'test' } });
      const metrics = await page.evaluate(path => {
        const style = node => { const c = getComputedStyle(node), r = node.getBoundingClientRect(); return { width: r.width, height: r.height, color: c.color, background: c.backgroundColor, fontSize: c.fontSize, padding: c.padding, radius: c.borderRadius, opacity: c.opacity }; };
        const wrapper = document.querySelector(path === '/mun' ? '.signin-passkey' : '[class*="wrapper_"]');
        const icon = document.querySelector(path === '/mun' ? '.signin-passkey-icon' : '[class*="passkeyIcon_"]');
        const glyph = getComputedStyle(icon.querySelector('i'), '::before');
        return { wrapper: style(wrapper), icon: style(icon), glyph: { content: glyph.content, font: glyph.fontFamily, size: glyph.fontSize }, buttons: [...document.querySelectorAll('button')].map(style) };
      }, path);
      const screenshot = await page.locator('#app').screenshot();
      await page.evaluate(() => fixture.resolve({ id: 'test-credential' }));
      await page.waitForFunction(() => fixture.done.length === 1 && !document.querySelector('button').disabled);
      assert.deepEqual(await page.evaluate(() => fixture.done), [{ id: 'test-credential' }]);
      await page.evaluate(() => { window.rippleSeen = false; new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches('.signin-passkey-ripple,[class*="ripple_"]') || node.querySelector('.signin-passkey-ripple,[class*="ripple_"]'))) window.rippleSeen = true; }).observe(document, { childList: true, subtree: true }); });
      await buttons.first().click();
      await page.waitForFunction(() => fixture.calls.length === 2);
      await page.waitForFunction(() => window.rippleSeen, null, { timeout: 3000 });
      assert.equal(await buttons.first().isDisabled(), true);
      await page.evaluate(() => fixture.reject(new Error('cancelled')));
      await page.waitForFunction(() => !document.querySelector('button').disabled);
      if (!passwordless) { await buttons.nth(1).click(); assert.equal(await page.evaluate(() => fixture.fallback), 1); }
      if (path === '/mun') {
        await buttons.first().click();
        await page.waitForFunction(() => fixture.calls.length === 3);
        await page.evaluate(() => { window.dispose(); fixture.resolve({ id: 'late' }); });
        await page.waitForTimeout(0);
        assert.equal(await page.evaluate(() => fixture.done.length), 1);
      }
      assert.deepEqual(errors, []);
      await page.close(); return { metrics, screenshot };
    }
    for (const passwordless of [false, true]) {
      const actual = await exercise('/mun', passwordless), reference = await exercise('/vue', passwordless);
      assert.deepEqual(actual.metrics, reference.metrics);
      assert.deepEqual(actual.screenshot, reference.screenshot);
    }
  } finally { await browser.close(); await server.close(); }
});

test('passkey service uses the actual WebAuthn adapter and forwards credentials', async () => {
  const empty = { name: 'empty-page', configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url !== '/empty') return next(); res.setHeader('content-type', 'text/html'); res.end('<!doctype html>'); }); } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, plugins: [empty], server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/empty`);
    const result = await page.evaluate(async () => {
      globalThis.PublicKeyCredential = function PublicKeyCredential() {};
      let challenge;
      Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: async options => {
        challenge = [...new Uint8Array(options.publicKey.challenge)];
        const bytes = n => new Uint8Array([n]).buffer;
        return { id: 'credential', rawId: bytes(2), type: 'public-key', response: { authenticatorData: bytes(3), clientDataJSON: bytes(4), signature: bytes(5), userHandle: null }, getClientExtensionResults: () => ({}), authenticatorAttachment: 'platform' };
      } } });
      const { createSigninPasskeyServices } = await import('/src/services/signin-passkey.mjs');
      let forwarded, fallback = 0;
      const services = createSigninPasskeyServices({ i18n: { ts: {} }, flow: { submitPasskey: value => { forwarded = value; }, useTotp: () => { fallback++; } } });
      const credential = await services.authenticate({ optionsJSON: { challenge: 'AQ' } });
      services.done(credential); services.useTotp();
      return { challenge, credential, forwarded, fallback };
    });
    assert.deepEqual(result.challenge, [1]);
    assert.deepEqual(result.credential, { id: 'credential', rawId: 'Ag', type: 'public-key', response: { authenticatorData: 'Aw', clientDataJSON: 'BA', signature: 'BQ', userHandle: undefined }, clientExtensionResults: {}, authenticatorAttachment: 'platform' });
    assert.deepEqual(result.forwarded, result.credential); assert.equal(result.fallback, 1);
    await page.close();
  } finally { await browser.close(); await server.close(); }
});
