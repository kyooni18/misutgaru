/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, webkit } from '@playwright/test';
import { munPlugin } from '@mun/vite';

test('composed native sign-in moves from username through CAPTCHA and TOTP', async () => {
  const entry=`import {mount} from '@mun/web';import {namedArguments} from '@mun/core/compat';import {SigninView} from '/src/components/SigninView.mun';import {createSigninViewServices} from '/src/services/signin-view.mjs';
  window.fixture={requests:[],logins:[]};let release;window.release=()=>release();
  const api=async(endpoint,data)=>{fixture.requests.push({endpoint,data});if(endpoint==='users/show'){await new Promise(r=>release=r);return {username:data.username,name:'Alice',avatarUrl:'/avatar.png'}};if(data.token)return {finished:true,i:'session-token'};if(data.password)return {finished:false,next:'totp'};return {finished:false,next:'captcha'}};
  const labels={username:'Username',password:'Password',forgotPassword:'Forgot password',welcomeBackWithName:'Welcome {name}',continue:'Continue',or:'or',signinWithPasskey:'Sign in with passkey',token:'Token','2fa':'Two-factor authentication',useBackupCode:'Use backup code',useTotp:'Use TOTP',loading:'Loading'};
  const services=createSigninViewServices({api,i18n:{ts:labels},instance:{enableTestcaptcha:true},supportsWebAuthn:()=>false,host:'example.com',initialUsername:'alice',resetPassword:()=>{},onLogin:result=>fixture.logins.push(result)});window.dispose=mount(SigninView(namedArguments({services})),document.querySelector('#app'));`;
  const plugin={name:'signin-view-fixture',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<style>:root{--MI-margin:16px;--MI_THEME-panel:white;--MI_THEME-fg:#222;--MI_THEME-accent:green}#app{width:336px}</style><div id="app"></div><script type="module" src="/entry.js"></script>');});},resolveId(id){if(id==='/entry.js')return '\0signin-view';},load(id){if(id==='\0signin-view')return entry;}};
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,plugins:[plugin,munPlugin()],server:{host:'127.0.0.1',port:0,fs:{allow:[fileURLToPath(new URL('..',import.meta.url)),fileURLToPath(new URL('../../packages/icons-subsetter',import.meta.url)),process.env.MUN_ROOT??'/Users/kyooni18/Code/Mun']}}});await server.listen();const browser=await (process.env.SIGNIN_BROWSER==='webkit'?webkit:chromium).launch();
  try {const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);const username=page.locator('input[autocomplete="username webauthn"]');await username.waitFor();await page.waitForFunction(()=>document.querySelector('input[autocomplete="username webauthn"]').value==='alice');
    await username.fill('bad-name');await page.getByTestId('signin-page-input-continue').click();assert.deepEqual(await page.evaluate(()=>fixture.requests),[]);
    await username.fill('alice');await page.getByTestId('signin-page-input-continue').click();await page.getByRole('status').waitFor();assert.equal(await page.locator('[inert]').count(),1);await page.evaluate(()=>window.release());
    const password=page.locator('input[type=password]');await password.waitFor();await password.fill('secret');await page.getByTestId('testcaptcha-input').fill('ai-chan-kawaii');await page.getByTestId('testcaptcha-submit').click();await page.getByTestId('signin-page-password-continue').click();
    const token=page.locator('input[autocomplete="one-time-code"]');await token.waitFor();await token.fill('123456');await token.press('Enter');await page.waitForFunction(()=>fixture.logins.length===1);
    const result=await page.evaluate(()=>fixture);assert.deepEqual(result.requests,[{endpoint:'users/show',data:{username:'alice'}},{endpoint:'signin-flow',data:{username:'alice'}},{endpoint:'signin-flow',data:{username:'alice',password:'secret','hcaptcha-response':null,'m-captcha-response':null,'g-recaptcha-response':null,'turnstile-response':null,'testcaptcha-response':'testcaptcha-passed'}},{endpoint:'signin-flow',data:{username:'alice',password:'secret',token:'123456'}}]);assert.deepEqual(result.logins,[{finished:true,i:'session-token'}]);await page.evaluate(()=>window.dispose());assert.equal(await page.locator('#app').innerHTML(),'');assert.deepEqual(errors,[]);await page.close();
  } finally {await browser.close();await server.close();}
});
