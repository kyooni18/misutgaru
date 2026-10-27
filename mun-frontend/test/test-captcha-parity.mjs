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

test('test CAPTCHA matches Vue on failure, success, reset and unmount', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
  const native = fileURLToPath(new URL('../src/components/TestCaptcha.mun', import.meta.url));
  const entries = {
    '/vue.js': `import {createApp,h,ref} from 'vue'; import Captcha from '/@fs/${frontend}src/components/MkCaptcha.vue'; window.fixture={values:[]}; const widget=ref(); const app=createApp({render:()=>h(Captcha,{ref:widget,provider:'testcaptcha',sitekey:null,'onUpdate:modelValue':v=>fixture.values.push(v)})}); app.mount('#app'); window.reset=()=>widget.value.reset(); window.dispose=()=>app.unmount();`,
    '/mun.js': `import {mount} from '@mun/web'; import {namedArguments} from '@mun/core/compat'; import {TestCaptcha} from '/@fs/${native}'; import {createTestCaptchaServices} from '/src/services/test-captcha.mjs'; window.fixture={values:[]}; const services=createTestCaptchaServices(v=>fixture.values.push(v)); window.reset=()=>services.reset(); window.dispose=mount(TestCaptcha(namedArguments({services})),document.querySelector('#app'));`,
  };
  const plugin = { name:'captcha-fixture', enforce:'pre', configureServer(server) { server.middlewares.use((req,res,next)=>{ if (!['/vue','/mun'].includes(req.url)) return next(); res.setHeader('content-type','text/html'); res.end(`<div id="app"></div><script type="module" src="${req.url}.js"></script>`); }); }, resolveId(id) { if (Object.hasOwn(entries,id) || id === '@/store.js' || id === '@mcaptcha/core-glue') return '\0captcha:' + id; }, load(id) { if (id.startsWith('\0captcha:')) return entries[id.slice(9)] ?? (id.endsWith('@mcaptcha/core-glue') ? 'export default class {}' : 'export const store={s:{darkMode:false}}'); } };
  const server = await createServer({ root:fileURLToPath(new URL('..',import.meta.url)), configFile:false, plugins:[plugin,munPlugin(),vue()], server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,fileURLToPath(new URL('..',import.meta.url)),process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun']}} });
  await server.listen();
  const browser = await (process.env.CAPTCHA_BROWSER === 'webkit' ? webkit : chromium).launch();
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function exercise(path) {
      const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+path); const input=page.getByTestId('testcaptcha-input'); await input.waitFor();
      await input.fill('wrong'); await page.getByTestId('testcaptcha-submit').click();
      assert.equal(await input.inputValue(),''); assert.deepEqual(await page.evaluate(()=>fixture.values),[null]);
      await input.fill('ai-chan-kawaii'); await page.getByTestId('testcaptcha-submit').click();
      assert.equal(await page.getByText('Test captcha passed!').count(),1);
      assert.deepEqual(await page.evaluate(()=>fixture.values),[null,'testcaptcha-passed']);
      await page.evaluate(()=>window.reset()); await input.waitFor(); assert.equal(await input.inputValue(),'');
      assert.deepEqual(await page.evaluate(()=>fixture.values),[null,'testcaptcha-passed']);
      await page.evaluate(()=>window.dispose()); assert.equal(await page.locator('#app').innerHTML(),''); assert.deepEqual(errors,[]); await page.close();
    }
    await exercise('/vue'); await exercise('/mun');
  } finally { await browser.close(); await server.close(); }
});
