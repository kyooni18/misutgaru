/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from '@playwright/test';

// Exercise the actual Vue coordinator; page components are controlled emitters
// so this records protocol/state transitions without real credentials.
test('Vue sign-in reference covers CAPTCHA, TOTP, errors and passwordless passkeys', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const stubs = {
    'misskey-js': 'export {}',
    '@simplewebauthn/browser': 'export const browserSupportsWebAuthn=()=>window.fixture.webauthn',
    '@/preferences.js': 'export const prefer={s:{animation:false}}',
    '@/utility/misskey-api.js': `export async function misskeyApi(endpoint,data) {
      window.fixture.calls.push([endpoint,structuredClone(data)]);
      if(endpoint==='users/show') return {id:'u',username:'alice'};
      if(endpoint==='signin-with-passkey') return data.credential ? {signinResponse:{finished:true,i:'test-token'}} : {context:'test-context',option:{challenge:'test'}};
      if(endpoint==='signin-flow') {
        if(!data.password) return {finished:false,next:'captcha'};
        if(window.fixture.fail) throw {id:'932c904e-9460-45b7-9ce6-7ed33be7eb2c'};
        if(window.fixture.forcePasskey) return {finished:false,next:'passkey',authRequest:{challenge:'test'}};
        if(!data.token) return {finished:false,next:'totp'};
        return {finished:true,i:'test-token'};
      }
      throw new Error(endpoint);
    }`,
    '@/utility/show-suspended-dialog.js': 'export const showSuspendedDialog=()=>window.fixture.alerts.push("suspended")',
    '@/i18n.js': 'export const i18n={ts:{loginFailed:"Login failed",incorrectPassword:"Incorrect password"}}',
    '@/os.js': 'export const alert=async value=>{window.fixture.alerts.push(value)}',
    '@/accounts.js': 'export const login=async token=>{window.fixture.logins.push(token)}',
    '@/components/MkSignin.input.vue': `import {h} from 'vue'; export default {emits:['usernameSubmitted','passkeyClick'],render(){return h('div',{id:'input'},[h('button',{id:'username',onClick:()=>this.$emit('usernameSubmitted','alice')},'username'),h('button',{id:'passkey',onClick:()=>this.$emit('passkeyClick')},'passkey')])}}`,
    '@/components/MkSignin.password.vue': `import {h} from 'vue'; export default {props:['user','needCaptcha'],emits:['passwordSubmitted'],methods:{resetCaptcha(){window.fixture.resets++}},render(){return h('button',{id:'password','data-captcha':String(this.needCaptcha),onClick:()=>this.$emit('passwordSubmitted',{password:'test-password',captcha:{hCaptchaResponse:'test-hcaptcha',mCaptchaResponse:null,reCaptchaResponse:null,turnstileResponse:null,testcaptchaResponse:null}})},'password')}}`,
    '@/components/MkSignin.totp.vue': `import {h} from 'vue'; export default {emits:['totpSubmitted'],render(){return h('button',{id:'totp',onClick:()=>this.$emit('totpSubmitted','123456')},'totp')}}`,
    '@/components/MkSignin.passkey.vue': `import {h} from 'vue'; export default {props:['credentialRequest','isPerformingPasswordlessLogin'],emits:['done','useTotp'],render(){return h('button',{id:'credential',onClick:()=>this.$emit('done',{id:'test-credential'})},'credential')}}`,
  };
  const entry = `import {createApp,h} from 'vue'; import Signin from '/@fs/${frontend}src/components/MkSignin.vue'; window.fixture={calls:[],alerts:[],logins:[],emitted:[],errors:[],resets:0,webauthn:true,fail:false}; const app=createApp({render:()=>h(Signin,{autoSet:true,onLogin:result=>window.fixture.emitted.push(result)})}); app.config.errorHandler=error=>window.fixture.errors.push(error); app.component('MkLoading',{render:()=>h('div',{id:'loading'})}); app.component('NoTransition',{inheritAttrs:false,setup(_,{slots}){return()=>slots.default?.()}}); app.mount('#app');`;
  const plugin = { name: 'signin-reference', enforce: 'pre', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url !== '/reference') return next(); res.setHeader('content-type', 'text/html'); res.end('<div id="app"></div><script type="module" src="/signin-entry.js"></script>'); }); }, resolveId(id) { if (id === '/signin-entry.js') return '\0signin:entry'; if (Object.hasOwn(stubs, id)) return '\0signin:' + id; }, load(id) { if (id === '\0signin:entry') return entry; if (id.startsWith('\0signin:')) return stubs[id.slice(8)]; }, transform(code, id) { if (id.endsWith('/MkSignin.vue')) return code.replace('<Transition', '<NoTransition').replace('</Transition>', '</NoTransition>'); } };
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, plugins: [plugin, vue()], server: { host: '127.0.0.1', port: 0, fs: { allow: [frontend, fileURLToPath(new URL('..', import.meta.url))] } } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const url = `http://127.0.0.1:${server.httpServer.address().port}/reference`;
    const page = await browser.newPage();
    await page.goto(url);
    await page.locator('#username').click();
    await page.locator('#password').waitFor();
    assert.equal(await page.locator('#password').getAttribute('data-captcha'), 'true');
    await page.locator('#password').click();
    await page.locator('#totp').waitFor();
    await page.locator('#totp').click();
    await page.waitForFunction(() => window.fixture.logins.length === 1);
    assert.deepEqual(await page.evaluate(() => window.fixture.calls), [
      ['users/show', { username: 'alice' }], ['signin-flow', { username: 'alice' }],
      ['signin-flow', { username: 'alice', password: 'test-password', 'hcaptcha-response': 'test-hcaptcha', 'm-captcha-response': null, 'g-recaptcha-response': null, 'turnstile-response': null, 'testcaptcha-response': null }],
      ['signin-flow', { username: 'alice', password: 'test-password', token: '123456' }],
    ]);
    assert.deepEqual(await page.evaluate(() => window.fixture.logins), ['test-token']);
    assert.deepEqual(await page.evaluate(() => window.fixture.emitted), [{ finished: true, i: 'test-token' }]);
    await page.goto(url);
    await page.locator('#passkey').click();
    await page.locator('#credential').click();
    await page.waitForFunction(() => window.fixture.logins.length === 1);
    assert.deepEqual(await page.evaluate(() => window.fixture.calls), [['signin-with-passkey', {}], ['signin-with-passkey', { credential: { id: 'test-credential' }, context: 'test-context' }]]);
    await page.goto(url);
    await page.evaluate(() => { window.fixture.webauthn = false; window.fixture.forcePasskey = true; });
    await page.locator('#username').click();
    await page.locator('#password').click();
    await page.locator('#totp').waitFor();
    assert.equal(await page.evaluate(() => window.fixture.calls.some(([endpoint]) => endpoint === 'signin-with-passkey')), false);
    await page.goto(url);
    await page.locator('#username').click();
    await page.locator('#password').waitFor();
    await page.evaluate(() => { window.fixture.fail = true; });
    await page.locator('#password').click();
    await page.waitForFunction(() => window.fixture.alerts.length === 1);
    assert.deepEqual(await page.evaluate(() => window.fixture.alerts[0]), { type: 'error', title: 'Login failed', text: 'Incorrect password' });
    assert.deepEqual(await page.evaluate(() => window.fixture.errors), [{ id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c' }]);
    assert.equal(await page.locator('#password').count(), 1);
    await page.close();
  } finally { await browser.close(); await server.close(); }
});
