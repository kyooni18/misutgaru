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

test('mCaptcha iframe and receiver match Vue with controlled messages', async () => {
  const frontend=fileURLToPath(new URL('../../packages/frontend/',import.meta.url));
  const component=fileURLToPath(new URL('../src/components/Mcaptcha.mun',import.meta.url));
  const entries={
    '/vue.js': `import {createApp,h,ref} from 'vue'; import Captcha from '/@fs/${frontend}src/components/MkCaptcha.vue'; window.fixture={values:[]};const widget=ref();const app=createApp({render:()=>h(Captcha,{ref:widget,provider:'mcaptcha',sitekey:'key with space',instanceUrl:'https://captcha.example/base','onUpdate:modelValue':v=>fixture.values.push(v)})});app.mount('#app');window.reset=()=>widget.value.reset();window.dispose=()=>app.unmount();`,
    '/mun.js': `import {mount} from '@mun/web';import {namedArguments} from '@mun/core/compat';import {Mcaptcha} from '/@fs/${component}';import {createMcaptcha} from '/src/services/mcaptcha.mjs';window.fixture={values:[]};const widget=createMcaptcha({sitekey:'key with space',instanceUrl:'https://captcha.example/base',update:v=>fixture.values.push(v)});window.reset=()=>widget.reset();window.dispose=mount(Mcaptcha(namedArguments({widget})),document.querySelector('#app'));`,
  };
  const plugin={name:'mcaptcha-fixture',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(!['/vue','/mun'].includes(req.url))return next();res.setHeader('content-type','text/html');res.end(`<div id="app"></div><script type="module" src="${req.url}.js"></script>`);});},resolveId(id, importer){if(id==='@mcaptcha/core-glue' && importer?.includes('MkCaptcha.vue'))return '\0mcaptcha:receiver';if(Object.hasOwn(entries,id)||id==='@/store.js')return '\0mcaptcha:'+id;},load(id){if(id.startsWith('\0mcaptcha:'))return entries[id.slice(10)]??(id.endsWith('receiver') ? `export default class { constructor(config,update){this.host=config.siteKey.instanceUrl.host;this.handler=e=>{if(new URL(e.origin).host===this.host)update(e.data.token)}} listen(){window.addEventListener('message',this.handler)} destroy(){window.removeEventListener('message',this.handler)} }` : 'export const store={s:{darkMode:false}}');}};
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{_DEV_:'false'},plugins:[plugin,munPlugin(),vue()],server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,fileURLToPath(new URL('..',import.meta.url)),process.env.MUN_ROOT??'/Users/kyooni18/Code/Mun']}}});await server.listen();
  const browser=await (process.env.CAPTCHA_BROWSER==='webkit'?webkit:chromium).launch();
  try {const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://captcha.example/**',route=>route.fulfill({status:200,body:'widget'}));await page.goto(`${base}/${path}`);const frame=page.locator('iframe');await frame.waitFor();const src=await frame.getAttribute('src');await page.waitForTimeout(200);
      await page.evaluate(()=>{window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',data:{token:'bad'}}));window.dispatchEvent(new MessageEvent('message',{origin:'https://captcha.example',data:{token:'good'}}));});
      const before=await page.evaluate(()=>fixture.values.slice());await page.evaluate(()=>window.reset());await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://captcha.example',data:{token:'after-reset'}})));const after=await page.evaluate(()=>fixture.values.slice());await page.evaluate(()=>window.dispose());await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://captcha.example',data:{token:'late'}})));assert.deepEqual(await page.evaluate(()=>fixture.values),after);assert.deepEqual(errors,[]);await page.close();return {src,before,after};}
    const reference=await exercise('vue'),native=await exercise('mun');assert.deepEqual(native,reference);assert.equal(native.src,'https://captcha.example/widget?sitekey=key+with+space');assert.ok(native.before.includes('good'));assert.ok(!native.before.includes('bad'));assert.ok(native.after.includes('after-reset'));
  } finally {await browser.close();await server.close();}
});
