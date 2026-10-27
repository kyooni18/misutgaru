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

test('script CAPTCHA widget lifecycle matches Vue', async () => {
  const frontend=fileURLToPath(new URL('../../packages/frontend/',import.meta.url));
  const component=fileURLToPath(new URL('../src/components/CaptchaWidget.mun',import.meta.url));
  const setup=`window.fixture={events:[],values:[]}; const provider=new URL(location.href).searchParams.get('provider'); const name=provider==='recaptcha'?'grecaptcha':provider; window[name]={render(el,options){fixture.events.push(['render',options.sitekey,options.theme,el.parentElement!=null]);window.options=options;return 'widget-id'},reset(id){fixture.events.push(['reset',id])},remove(id){fixture.events.push(['remove',id])}};`;
  const entries={
    '/vue.js': `${setup} import {createApp,h,ref} from 'vue'; import Captcha from '/@fs/${frontend}src/components/MkCaptcha.vue'; const widget=ref();const app=createApp({render:()=>h(Captcha,{ref:widget,provider,sitekey:'site-key','onUpdate:modelValue':v=>fixture.values.push(v)})});app.mount('#app');window.reset=()=>widget.value.reset();window.dispose=()=>app.unmount();`,
    '/mun.js': `${setup} import {mount} from '@mun/web';import {namedArguments} from '@mun/core/compat';import {CaptchaWidget} from '/@fs/${component}';import {createCaptchaWidget} from '/src/services/captcha-widget.mjs';const widget=createCaptchaWidget({provider,sitekey:'site-key',update:v=>fixture.values.push(v)});window.reset=()=>widget.reset();window.dispose=mount(CaptchaWidget(namedArguments({widget})),document.querySelector('#app'));`,
  };
  const plugin={name:'widget-fixture',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url.startsWith('/vue?')&&!req.url.startsWith('/mun?'))return next();res.setHeader('content-type','text/html');res.end(`<div id="app"></div><script type="module" src="${req.url.startsWith('/vue?')?'/vue.js':'/mun.js'}"></script>`);});},resolveId(id){if(Object.hasOwn(entries,id)||id==='@/store.js'||id==='@mcaptcha/core-glue')return '\0widget:'+id;},load(id){if(id.startsWith('\0widget:'))return entries[id.slice(8)]??(id.endsWith('@mcaptcha/core-glue')?'export default class {}':'export const store={s:{darkMode:false}}');}};
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{_DEV_:'false'},plugins:[plugin,munPlugin(),vue()],server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,fileURLToPath(new URL('..',import.meta.url)),process.env.MUN_ROOT??'/Users/kyooni18/Code/Mun']}}});await server.listen();
  const browser=await (process.env.CAPTCHA_BROWSER==='webkit'?webkit:chromium).launch();
  try { const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path,provider){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/${path}?provider=${provider}`);await page.waitForFunction(()=>window.options);await page.evaluate(()=>{options.callback('token');options['expired-callback']();options['error-callback']();window.reset();window.dispose();});const result=await page.evaluate(()=>fixture);assert.deepEqual(errors,[]);await page.close();return result;}
    for(const provider of ['hcaptcha','recaptcha','turnstile']) {const reference=await exercise('vue',provider),native=await exercise('mun',provider);assert.deepEqual(native,reference);assert.deepEqual(native.values,['token',null,null]);assert.deepEqual(native.events,[['render','site-key','light',true],['reset','widget-id'],['reset','widget-id'],['remove','widget-id']]);}
  } finally {await browser.close();await server.close();}
});
