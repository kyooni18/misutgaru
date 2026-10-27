/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Compares isolated, initial button rendering with the actual Vue reference.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import config from './vite.config.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
const stubs = {
  'misskey-js': 'export {}',
  '@@/js/config.js': 'export const host="local.test"',
  '@/os.js': 'export const confirm=async()=>({canceled:false})',
  '@/utility/misskey-api.js': 'export const misskeyApi=()=>new Promise(()=>{})',
  '@/stream.js': 'export const useStream=()=>({useChannel:()=>({on(){},dispose(){}})})',
  '@/i18n.js': 'export const i18n={ts:{followRequestPending:"Pending",processing:"Processing",youFollowing:"Following",followRequest:"Request",follow:"Follow"},tsx:{unfollowConfirm:()=>"",cancelFollowRequestConfirm:()=>"",followConfirm:()=>""}}',
  '@/utility/achievements.js': 'export const claimAchievement=()=>{}',
  '@/utility/please-login.js': 'export const pleaseLogin=async()=>true',
  '@/i.js': 'export const $i={followingCount:0}',
  '@/preferences.js': 'export const prefer={s:{alwaysConfirmFollow:false,defaultFollowWithReplies:true}}',
  '@/utility/haptic.js': 'export const haptic=()=>{}',
};
const entry = `import {createApp,h} from 'vue';
import FollowButton from '/@fs/${frontend}src/components/MkFollowButton.vue';
import Loading from '/@fs/${frontend}src/components/global/MkLoading.vue';
const q=new URLSearchParams(location.search);
const user={id:'1',username:'alice',host:null,isFollowing:q.has('following'),hasPendingFollowRequestFromYou:q.has('pending'),isLocked:q.has('locked')};
const app=createApp({render:()=>h(FollowButton,{user,full:true})}); app.component('MkLoading',Loading); app.mount('#app');`;
const html = `<!doctype html><style>:root{--MI_THEME-fgOnWhite:#222;--MI_THEME-fgOnAccent:#fff;--MI_THEME-accent:#3366dd;--MI_THEME-fg:#333}body{margin:20px;font:14px sans-serif}._button{appearance:none;cursor:pointer;font-family:inherit}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="app"></div><script type="module" src="/__vue-entry.js"></script>`;
const virtual = { name: 'follow-vue-reference', enforce: 'pre', configureServer(vite) { vite.middlewares.use((req,res,next)=>{ if (req.url?.split('?')[0] !== '/__vue') return next(); res.setHeader('content-type','text/html'); res.end(html); }); }, resolveId(id) { if(id === '/__vue-entry.js') return '\0vue-entry'; if (Object.hasOwn(stubs,id)) return '\0stub:'+id; }, load(id) { if(id==='\0vue-entry') return entry; if(id.startsWith('\0stub:')) return stubs[id.slice(6)]; } };
const require = createRequire(import.meta.url);
const server = await createServer({ ...config, root, configFile:false, resolve:{alias:{vue:require.resolve('vue/dist/vue.esm-bundler.js')}}, plugins:[virtual,...config.plugins,vue()], server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,root,process.env.MUN_ROOT ?? '../../packages/modules/Mun']} } });
await server.listen();
const browser = await chromium.launch();
try {
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const query of ['', '?locked=1', '?following=1', '?pending=1&locked=1', '?pending=1']) {
    const page = await browser.newPage({viewport:{width:400,height:150}});
    const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    await page.goto(origin+'/__vue'+query); await page.locator('button').waitFor();
    const reference = await page.locator('button').evaluate(el=>({text:el.textContent, width:el.getBoundingClientRect().width, height:el.getBoundingClientRect().height, color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, icon:el.querySelector('i')?.className ?? null}));
    const referenceShot = await page.locator('button').screenshot();
    await page.goto(origin+'/fixture.html'+query); await page.waitForFunction(()=>window.fixture);
    await page.addStyleTag({content:':root{--MI_THEME-fgOnWhite:#222;--MI_THEME-fgOnAccent:#fff;--MI_THEME-accent:#3366dd;--MI_THEME-fg:#333}body{margin:20px;font:14px sans-serif}._button{appearance:none;cursor:pointer;font-family:inherit}*,*::before,*::after{animation:none!important;transition:none!important}'});
    const actual = await page.locator('button').evaluate(el=>({text:el.textContent, width:el.getBoundingClientRect().width, height:el.getBoundingClientRect().height, color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, icon:el.querySelector('i')?.className ?? null}));
    assert.deepEqual(errors, []); assert.deepEqual(actual,reference,query || 'default');
    assert.deepEqual(await page.locator('button').screenshot(), referenceShot, `pixels: ${query || 'default'}`);
    console.log(`PASS Vue/Mün initial rendering ${query || 'default'}`); await page.close();
  }
} finally { await browser.close(); await server.close(); }
