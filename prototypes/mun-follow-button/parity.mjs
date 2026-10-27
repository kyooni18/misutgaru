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
import path from 'node:path';
import { access, realpath } from 'node:fs/promises';
import config from './vite.config.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const frontend = fileURLToPath(new URL('../../packages/frontend/', import.meta.url));
const iconDir = await realpath(path.resolve(process.env.MUN_ICON_DIR ?? path.join(frontend, 'node_modules/icons-subsetter/built')));
await access(path.join(iconDir, 'tabler-icons-frontend.css'));
const iconCss = '/@fs/' + path.join(iconDir, 'tabler-icons-frontend.css');
const stubs = {
  'misskey-js': 'export {}',
  '@@/js/config.js': 'export const host="local.test"',
  '@/os.js': 'export const confirm=async()=>({canceled:false})',
  '@/utility/misskey-api.js': 'export const misskeyApi=(endpoint,data)=>{window.parity.calls.push([endpoint,data]);return new Promise(resolve=>window.parity.resolve=resolve)}',
  '@/stream.js': 'export const useStream=()=>({useChannel:()=>({on(event,fn){window.parity.listeners[event]=fn},dispose(){}})})',
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
window.parity={calls:[],listeners:{}};
const q=new URLSearchParams(location.search);
const user={id:'1',username:'alice',host:null,isFollowing:q.has('following'),hasPendingFollowRequestFromYou:q.has('pending'),isLocked:q.has('locked')};
const app=createApp({render:()=>h(FollowButton,{user,full:!q.has('compact'),large:q.has('large')})}); app.component('MkLoading',Loading); app.mount('#app');`;
const html = `<!doctype html><style>:root{--MI_THEME-fgOnWhite:#222;--MI_THEME-fgOnAccent:#fff;--MI_THEME-accent:#3366dd;--MI_THEME-fg:#333}body{margin:20px;font:14px sans-serif}._button{appearance:none;cursor:pointer;font-family:inherit}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="app"></div><script type="module" src="/__vue-entry.js"></script>`;
const virtual = { name: 'follow-vue-reference', enforce: 'pre', configureServer(vite) { vite.middlewares.use((req,res,next)=>{ if (req.url?.split('?')[0] !== '/__vue') return next(); res.setHeader('content-type','text/html'); res.end(html); }); }, resolveId(id) { if(id === '/__vue-entry.js') return '\0vue-entry'; if (Object.hasOwn(stubs,id)) return '\0stub:'+id; }, load(id) { if(id==='\0vue-entry') return entry; if(id.startsWith('\0stub:')) return stubs[id.slice(6)]; } };
const require = createRequire(import.meta.url);
const server = await createServer({ ...config, root, configFile:false, resolve:{alias:{vue:require.resolve('vue/dist/vue.esm-bundler.js')}}, plugins:[virtual,...config.plugins,vue()], server:{host:'127.0.0.1',port:0,fs:{allow:[frontend,root,iconDir,process.env.MUN_ROOT ?? '../../packages/modules/Mun']} } });
await server.listen();
const browser = await chromium.launch();
try {
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const query of ['', '?locked=1', '?following=1', '?pending=1&locked=1', '?pending=1', '?compact=1', '?compact=1&following=1', '?compact=1&pending=1', '?large=1', '?large=1&locked=1']) {
    const page = await browser.newPage({viewport:{width:400,height:150}});
    const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    await page.goto(origin+'/__vue'+query); await page.locator('button').waitFor();
    await page.addStyleTag({url:iconCss}); await page.addStyleTag({content:'button > div { opacity: .8 !important }'}); await page.evaluate(async () => { const icon = document.querySelector('button i'); if (icon) await document.fonts.load('16px tabler-icons', getComputedStyle(icon, '::before').content.slice(1, -1)); await document.fonts.ready; });
    assert.equal(await page.evaluate(() => { const icon = document.querySelector('button i'); return !icon || (getComputedStyle(icon).fontFamily.includes('tabler-icons') && getComputedStyle(icon, '::before').content !== 'none' && document.fonts.check('16px tabler-icons', getComputedStyle(icon, '::before').content.slice(1, -1))); }), true);
    const reference = await page.locator('button').evaluate(el=>({type:el.getAttribute('type'), text:el.textContent, width:el.getBoundingClientRect().width, height:el.getBoundingClientRect().height, color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, icon:el.querySelector('i')?.className ?? null}));
    const referenceShot = await page.locator('button').screenshot();
    await page.goto(origin+'/fixture.html'+query); await page.waitForFunction(()=>window.fixture);
    await page.addStyleTag({url:iconCss}); await page.addStyleTag({content:'button > div { opacity: .8 !important }'}); await page.evaluate(async () => { const icon = document.querySelector('button i'); if (icon) await document.fonts.load('16px tabler-icons', getComputedStyle(icon, '::before').content.slice(1, -1)); await document.fonts.ready; });
    assert.equal(await page.evaluate(() => { const icon = document.querySelector('button i'); return !icon || (getComputedStyle(icon).fontFamily.includes('tabler-icons') && getComputedStyle(icon, '::before').content !== 'none' && document.fonts.check('16px tabler-icons', getComputedStyle(icon, '::before').content.slice(1, -1))); }), true);
    await page.addStyleTag({content:':root{--MI_THEME-fgOnWhite:#222;--MI_THEME-fgOnAccent:#fff;--MI_THEME-accent:#3366dd;--MI_THEME-fg:#333}body{margin:20px;font:14px sans-serif}._button{appearance:none;cursor:pointer;font-family:inherit}*,*::before,*::after{animation:none!important;transition:none!important}'});
    const actual = await page.locator('button').evaluate(el=>({type:el.getAttribute('type'), text:el.textContent, width:el.getBoundingClientRect().width, height:el.getBoundingClientRect().height, color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, icon:el.querySelector('i')?.className ?? null}));
    assert.deepEqual(errors, []); assert.deepEqual(actual,reference,query || 'default');
    const actualShot = await page.locator('button').screenshot();
    const pixels = await page.evaluate(async ([reference, actual]) => {
      const decode = async (data) => {
        const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return { width: image.width, height: image.height, pixels: ctx.getImageData(0, 0, image.width, image.height).data };
      };
      const a = await decode(reference), b = await decode(actual);
      if (a.width !== b.width || a.height !== b.height) return -1;
      let count = 0;
      for (let i = 0; i < a.pixels.length; i += 4) {
        if ([0, 1, 2, 3].some(channel => Math.abs(a.pixels[i + channel] - b.pixels[i + channel]) > 2)) count++;
      }
      return count;
    }, [referenceShot.toString('base64'), actualShot.toString('base64')]);
    assert.equal(pixels, 0, `pixels differing by more than two channel levels: ${query || 'default'}`);
    console.log(`PASS Vue/Mün initial rendering ${query || 'default'}`); await page.close();
  }
  const page = await browser.newPage();
  await page.goto(origin + '/__vue');
  await page.locator('button').click();
  await page.waitForFunction(() => parity.calls.length > 0);
  const vueCall = await page.evaluate(() => parity.calls[0]);
  assert.equal(await page.locator('button').isDisabled(), true);
  await page.evaluate(() => parity.resolve({}));
  await page.waitForFunction(() => !document.querySelector('button').disabled);
  const vuePending = await page.locator('button').innerText();
  await page.evaluate(() => parity.listeners.follow({id:'1',isFollowing:true,hasPendingFollowRequestFromYou:false}));
  await page.waitForFunction(() => document.querySelector('button').textContent === 'Following');
  await page.goto(origin + '/fixture.html');
  await page.waitForFunction(() => window.fixture);
  await page.locator('button').click();
  await page.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/create'));
  assert.deepEqual(await page.evaluate(() => fixture.calls.find(c => c[0] === 'following/create')), vueCall);
  assert.equal(await page.locator('button').isDisabled(), true);
  await page.evaluate(() => fixture.resolve({}));
  await page.waitForFunction(() => !document.querySelector('button').disabled);
  assert.equal(await page.locator('button').innerText(), vuePending);
  await page.evaluate(() => fixture.emit({id:'1',isFollowing:true,hasPendingFollowRequestFromYou:false}));
  await page.waitForFunction(() => document.querySelector('button').textContent === 'Following');
  console.log('PASS Vue/Mün follow request and stream confirmation');
  await page.close();
} finally { await browser.close(); await server.close(); }
