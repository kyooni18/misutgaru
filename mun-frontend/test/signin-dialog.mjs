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

test('native sign-in dialog cancels or emits completed sign-in once', async () => {
  const entry=`import {mount} from '@mun/web';import {namedArguments} from '@mun/core/compat';import {SigninDialog} from '/src/components/SigninDialog.mun';import {createSigninDialogServices} from '/src/services/signin-dialog.mjs';window.fixture={cancelled:0,done:[],requests:[]};let dispose;const labels={login:'Log in',close:'Close',username:'Username',password:'Password',forgotPassword:'Forgot password',welcomeBackWithName:'Welcome {name}',continue:'Continue',or:'or',signinWithPasskey:'Sign in with passkey',loading:'Loading'};const api=async(endpoint,data)=>{fixture.requests.push({endpoint,data});if(endpoint==='users/show')return {username:data.username,name:'Alice',avatarUrl:'/avatar.png'};if(data.password)return {finished:true,i:'token'};return {finished:false,next:'password'}};const services=createSigninDialogServices({api,i18n:{ts:labels},instance:{},host:'example.com',supportsWebAuthn:()=>false,resetPassword:()=>{},onDone:result=>{fixture.done.push(result);dispose()},onCancelled:()=>{fixture.cancelled++;dispose()}});window.openDialog=()=>{dispose=mount(SigninDialog(namedArguments({services})),document.querySelector('#app'))};window.openDialog();`;
  const plugin={name:'signin-dialog-fixture',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<style>:root{--MI-margin:16px;--MI_THEME-panel:white;--MI_THEME-fg:#222;--MI_THEME-accent:green;--MI_THEME-modalBg:#888;--MI_THEME-bg:white}#app{width:336px}</style><button id="before">Before</button><div id="app"></div><script type="module" src="/entry.js"></script>');});},resolveId(id){if(id==='/entry.js')return '\0signin-dialog';},load(id){if(id==='\0signin-dialog')return entry;}};
  const root=fileURLToPath(new URL('..',import.meta.url));const server=await createServer({root,configFile:false,plugins:[plugin,munPlugin()],server:{host:'127.0.0.1',port:0,fs:{allow:[root,fileURLToPath(new URL('../../packages/icons-subsetter',import.meta.url)),process.env.MUN_ROOT??'/Users/kyooni18/Code/Mun']}}});await server.listen();const browser=await (process.env.SIGNIN_BROWSER==='webkit'?webkit:chromium).launch();
  try {const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    for(const method of ['close','escape','backdrop','submit']) {const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByRole('dialog',{name:'Log in'}).waitFor();
      if(method==='close'){await page.getByRole('button',{name:'Close'}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Sign in with passkey'}).evaluate(el=>el===document.activeElement),true);await page.getByRole('button',{name:'Close'}).click();}
      if(method==='escape')await page.keyboard.press('Escape');
      if(method==='backdrop')await page.locator('.signin-dialog-backdrop').click({position:{x:5,y:5}});
      if(method==='submit'){await page.locator('input[autocomplete="username webauthn"]').fill('alice');await page.getByTestId('signin-page-input-continue').click();await page.locator('input[type=password]').fill('secret');await page.getByTestId('signin-page-password-continue').click();}
      await page.getByRole('dialog').waitFor({state:'detached'});const result=await page.evaluate(()=>fixture);assert.equal(result.cancelled,method==='submit'?0:1);assert.deepEqual(result.done,method==='submit'?[{finished:true,i:'token'}]:[]);assert.deepEqual(errors,[]);await page.close();}
  } finally {await browser.close();await server.close();}
});
