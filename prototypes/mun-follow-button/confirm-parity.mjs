/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium, webkit } from '@playwright/test';
import config from './vite.config.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
const require = createRequire(import.meta.url);
const stubs = {
  '@/components/MkModal.vue': `import {h} from 'vue';export default {emits:['click','closed','esc'],setup(p,{slots,emit}){return()=>h('div',{class:'vue-modal'},[h('div',{class:'vue-backdrop',onClick:()=>emit('click')}),h('div',{class:'vue-content',onClick:e=>{if(e.target===e.currentTarget)emit('click')}},slots.default?.())])}}`,
  '@/components/MkInput.vue': 'export default {}', '@/components/MkSelect.vue': 'export default {}',
  '@/components/global/MkA.vue': 'export default {}',
  '@/composables/use-mkselect.js': 'export const useMkSelect=()=>({def:[],model:null})',
  '@/i18n.js': 'export const i18n={ts:{ok:"OK",cancel:"Cancel"}}',
};
const entry = `import {createApp,h} from 'vue';import Dialog from '/@fs/${frontend}src/components/MkDialog.vue';import Icon from '/@fs/${frontend}src/components/global/MkSystemIcon.vue';const q=new URLSearchParams(location.search);const app=createApp({render:()=>h(Dialog,{type:q.get('type'),text:'Unfollow Alice?',showCancelButton:true})});app.component('MkSystemIcon',Icon);app.component('MkLoading',{});app.component('Mfm',{props:['text'],render(){return this.text}});app.mount('#app');`;
const theme = `:root{--MI_THEME-fg:#222;--MI_THEME-panel:#fff;--MI_THEME-modalBg:rgba(0,0,0,.5);--MI_THEME-warn:#c80;--MI_THEME-buttonBg:#ddd;--MI_THEME-buttonHoverBg:#ccc;--MI_THEME-fgOnAccent:#fff;--MI_THEME-accent:#36c;--MI-hairline:#aaa;--MI-easeOut:linear}body{margin:0;font:14px/1.5 sans-serif;background:#eee;color:var(--MI_THEME-fg)}._button{appearance:none;display:inline-block;padding:0;margin:0;background:none;border:none;cursor:pointer;color:inherit;font-size:1em;font-family:inherit;line-height:inherit;max-width:100%;user-select:none}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}button:focus{outline:none!important}[class*="animLine"],[class*="animCircle"]{stroke-dashoffset:0!important}[class*="animFade"]{opacity:1!important}.mun-confirm-symbol path,.mun-confirm-symbol circle{stroke-dashoffset:0!important;opacity:1!important}.vue-backdrop{position:fixed;inset:0;background:var(--MI_THEME-modalBg)}.vue-content{position:fixed;inset:0;margin:auto;padding:32px;display:flex;overflow:auto}@media(max-width:500px){.vue-content{padding:16px}}`;
const html = `<!doctype html><style>${theme}</style><button id="trigger">Open</button><div id="app"></div><script type="module" src="/__dialog-entry.js"></script>`;
const virtual = {name:'dialog-reference',enforce:'pre',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/__dialog')return next();res.setHeader('content-type','text/html');res.end(html);});},resolveId(id){if(id==='/__dialog-entry.js')return '\0dialog-entry';if(Object.hasOwn(stubs,id))return '\0stub:'+id;if(id.startsWith('@/'))return this.resolve(frontend+'src/'+id.slice(2).replace(/\.js$/,'.ts'),undefined,{skipSelf:true});},load(id){if(id==='\0dialog-entry')return entry;if(id.startsWith('\0stub:'))return stubs[id.slice(6)];}};
const server = await createServer({...config,root,configFile:false,resolve:{alias:{vue:require.resolve('vue/dist/vue.esm-bundler.js')}},plugins:[virtual,...config.plugins,vue()],server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,root,process.env.MUN_ROOT ?? '../../packages/modules/Mun']}}});
await server.listen();
const browser = await ({ chromium, webkit })[process.env.PARITY_BROWSER ?? 'chromium'].launch();
try {
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 for(const width of [390,1000]) for(const type of ['warning','question']) {
  const page=await browser.newPage({viewport:{width,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/__dialog?type=${type}`);await page.locator('.vue-content').waitFor();
  const vueBox=await page.locator('.vue-content > div').boundingBox();const baseline=await page.screenshot();
  await page.goto(`${origin}/confirm-fixture.html`);await page.addStyleTag({content:theme});
  if(type==='warning')await page.locator('#trigger').click(); else await page.evaluate(()=>{void window.openQuestion();});
  await page.locator('.mun-confirm-panel').waitFor();const nativeBox=await page.locator('.mun-confirm-panel').boundingBox();
  assert.deepEqual(errors,[]);assert.deepEqual(nativeBox,vueBox,`${type} layout @${width}`);
  const next=await page.screenshot();assert.ok(next.equals(baseline),`${type} screenshot @${width}`);
  console.log(`PASS Vue/Mün ${type} dialog @${width}`);await page.close();
 }
} finally {await browser.close();await server.close();}
