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

test('password and test CAPTCHA behavior matches Vue', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const native = fileURLToPath(new URL('../src/components/SigninPassword.mun', import.meta.url));
  const labels = `{welcomeBackWithName:'Welcome back, {name}',password:'Password',forgotPassword:'Forgot password',continue:'Continue'}`;
  const instance = `{enableTestcaptcha:true,enableHcaptcha:false,enableMcaptcha:false,enableRecaptcha:false,enableTurnstile:false}`;
  const stubs = {
    'misskey-js': 'export {}',
    '@/components/MkForgotPassword.vue': 'export default {}',
    '@/instance.js': `export const instance=${instance}`,
    '@/i18n.js': `export const i18n={ts:${labels}}`,
    '@/os.js': 'export function popup(){window.fixture.forgot++;return {dispose(){}}}',
    '@/store.js': 'export const store={s:{darkMode:false}}',
    '@mcaptcha/core-glue': 'export default class {}',
    '@/components/global/MkA.vue': 'export default {}',
    '@/utility/autocomplete.js': 'export class Autocomplete {}',
    '@/utility/id.js': 'export const genId=()=>"fixture-id"',
    '@/theme.js': 'export const themeManager={on(){},off(){}}',
    '@/utility/get-bg-color.js': `export function getBgColor(el){while(el){const color=getComputedStyle(el).backgroundColor;if(color!=='rgba(0, 0, 0, 0)') return color;el=el.parentElement}return null}`,
    'throttle-debounce': 'export const throttle=(_,fn)=>fn; export const debounce=(_,fn)=>fn',
  };
  const user = `{username:'alice',name:'Alice',avatarUrl:'/avatar.png'}`;
  const entries = {
    '/vue.js': `import {createApp,h,ref} from 'vue'; import Password from '/@fs/${frontend}src/components/MkSignin.password.vue'; import {adaptiveBorderDirective} from '/@fs/${frontend}src/directives/adaptive-border.ts'; window.fixture={submissions:[],forgot:0}; const widget=ref(); const app=createApp({render:()=>h(Password,{ref:widget,user:${user},needCaptcha:true,onPasswordSubmitted:v=>fixture.submissions.push(v)})}); app.component('I18n',{props:['src'],render(){return h('span',this.src.replace('{name}','Alice'))}}); app.component('Mfm',{props:['text'],render(){return this.text}}); app.directive('adaptive-border',adaptiveBorderDirective); app.mount('#app'); window.reset=()=>widget.value.resetCaptcha(); window.dispose=()=>app.unmount();`,
    '/mun.js': `import {mount} from '@mun/web'; import {namedArguments} from '@mun/core/compat'; import {SigninPassword} from '/@fs/${native}'; import {createSigninPasswordServices} from '/src/services/signin-password.mjs'; window.fixture={submissions:[],forgot:0}; const services=createSigninPasswordServices({i18n:{ts:${labels}},instance:${instance},resetPassword:()=>fixture.forgot++,flow:{submitPassword:v=>fixture.submissions.push(v)}}); window.reset=()=>services.resetCaptcha(); window.dispose=mount(SigninPassword(namedArguments({user:${user},needCaptcha:true,services})),document.querySelector('#app'));`,
  };
  const plugin = { name:'password-fixture', enforce:'pre', configureServer(server) { server.middlewares.use((req,res,next)=>{ if (!['/vue','/mun'].includes(req.url)) return next(); res.setHeader('content-type','text/html'); res.end(`<style>:root{--MI-margin:16px;--MI_THEME-panel:white;--MI_THEME-fg:#222;--MI_THEME-accent:green}#app{width:336px}._gaps{display:flex;flex-direction:column;gap:16px}._gaps_s{display:flex;flex-direction:column;gap:10px}</style><div id="app"></div><script type="module" src="${req.url}.js"></script>`); }); }, resolveId(id) { if (Object.hasOwn(entries,id) || Object.hasOwn(stubs,id)) return '\0password:' + id; if (id === '@/components/MkButton.vue' || id === '@/components/MkInput.vue' || id === '@/components/MkCaptcha.vue') return frontend+'src/components/'+id.split('/').pop(); }, load(id) { if (id.startsWith('\0password:')) return entries[id.slice(10)] ?? stubs[id.slice(10)]; } };
  const server = await createServer({ root:fileURLToPath(new URL('..',import.meta.url)), configFile:false, plugins:[plugin,munPlugin(),vue()], server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,fileURLToPath(new URL('..',import.meta.url)),fileURLToPath(new URL('../../packages/icons-subsetter',import.meta.url)),process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun']}} });
  await server.listen(); const browser = await (process.env.PASSWORD_BROWSER === 'webkit' ? webkit : chromium).launch();
  try {
    const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path) {
      const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); await page.goto(base+path);
      const input=page.locator('input[type=password]'); await input.waitFor(); const button=page.getByTestId('signin-page-password-continue');
      assert.equal(await button.isDisabled(),true); assert.equal(await input.getAttribute('autocomplete'),'current-password webauthn');
      assert.equal(await page.locator('input[name=username]').inputValue(),'alice');
      await input.fill('secret'); await page.getByText('Forgot password').click(); assert.equal(await page.evaluate(()=>fixture.forgot),1);
      await page.getByTestId('testcaptcha-input').fill('ai-chan-kawaii'); await page.getByTestId('testcaptcha-submit').click();
      assert.equal(await button.isEnabled(),true); await button.click();
      assert.deepEqual(await page.evaluate(()=>fixture.submissions),[{password:'secret',captcha:{hCaptchaResponse:null,mCaptchaResponse:null,reCaptchaResponse:null,turnstileResponse:null,testcaptchaResponse:'testcaptcha-passed'}}]);
      await page.evaluate(()=>window.reset()); assert.equal(await page.getByTestId('testcaptcha-input').inputValue(),'');
      await page.evaluate(()=>window.dispose()); assert.deepEqual(errors,[]); await page.close();
    }
    await exercise('/vue'); await exercise('/mun');
  } finally { await browser.close(); await server.close(); }
});
