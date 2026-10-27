/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium, webkit } from '@playwright/test';

// Native writer runs before Vue modules load, as after a reload. UI, network,
// and unrelated preferences are stubbed; account readers are actual sources.
test('Vue account readers consume native handoff after reload', async () => {
  const frontend = fileURLToPath(new URL('../../packages/frontend/src/', import.meta.url));
  const require = createRequire((process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun') + '/package.json');
  const stubs = {
    eventemitter3: 'export class EventEmitter { on() {} emit() {} }',
    '@@/js/config.js': 'export const host=location.host, apiUrl="/api", version="test", prefersReducedMotion=false;',
    '@@/js/intl-const.js': 'export const hemisphere="N";',
    '@/utility/device-kind.js': 'export const DEFAULT_DEVICE_KIND="desktop";',
    '@/utility/misskey-api.js': 'export const misskeyApi=async()=>({});',
    '@/utility/show-suspended-dialog.js': 'export const showSuspendedDialog=()=>{};',
    '@/i18n.js': 'export const i18n={ts:{}};',
    '@/os.js': 'export const waiting=()=>{},popup=()=>{},popupMenu=()=>{},success=()=>{},alert=()=>{};',
    '@/utility/unison-reload.js': 'export const unisonReload=()=>{},reloadChannel={postMessage(){}};',
    '@/signout.js': 'export const signout=()=>{};',
    '@/components/MkWaitingDialog.vue': 'export default {};',
    '@/utility/id.js': 'export const genId=()=>"fixture-id";',
    '@/utility/copy-to-clipboard.js': 'export const copyToClipboard=()=>{};',
    './def.js': 'export const PREF_DEF={accounts:{default:[]}};',
    '@/preferences.js': `import { PreferencesManager } from '${frontend}preferences/manager.ts';import { $i } from '${frontend}i.ts';export const prefer=new PreferencesManager({load:()=>JSON.parse(localStorage.getItem('preferences')),save:()=>{},cloudGetBulk:async()=>({})},$i);`,
  };
  const entry = `import {set} from 'idb-keyval';import {createAccountStorage} from '/src/services/account-storage.mjs';import {createAccountHandoff} from '/src/services/account-handoff.mjs';
    window.write=async()=>{const host=location.host;const base={accountTokens:{[host+'/old']:'old-token'},accountInfos:{[host+'/old']:{id:'old',username:'bob'}}};if(window.indexedDB)await set('pizzax::base',base);else localStorage.setItem('idbfallback::pizzax::base',JSON.stringify(base));localStorage.setItem('preferences',JSON.stringify({id:'p',version:'test',type:'main',modifiedAt:1,name:'',preferences:{accounts:[[{},[[host,{id:'old',username:'bob'}]],{}]]}}));const adapters=await createAccountStorage({host,makeChannel:()=>({postMessage(){},close(){}}),navigate:()=>{}});await createAccountHandoff({...adapters,host,fetch:async()=>({status:200,json:async()=>({id:'new',username:'alice',notesCount:0})})})('token');}; window.read=async()=>{const [{ $i },{store},{getAccounts},idb]=await Promise.all([import('${frontend}i.ts'),import('${frontend}store.ts'),import('${frontend}accounts.ts'),import('${frontend}utility/idb-proxy.ts')]);await store.ready;return {me:$i,accounts:await getAccounts(),worker:await idb.get('accounts')};};`;
  const plugin = { name:'vue-account-readers', enforce:'pre', configureServer(server) { server.middlewares.use((req,res,next) => { if(req.url!=='/') return next(); res.setHeader('content-type','text/html');res.end('<script>window._DEV_=false</script><script type="module" src="/entry.js"></script>'); }); }, resolveId(id) { if(id==='/entry.js') return '\0entry'; if(id==='vue') return require.resolve('vue/dist/vue.esm-bundler.js'); if(id==='misskey-js') return fileURLToPath(new URL('../node_modules/misskey-js/built/index.js',import.meta.url)); if(id==='broadcast-channel') return fileURLToPath(new URL('../node_modules/broadcast-channel/dist/esbrowser/index.js',import.meta.url)); if(id==='idb-keyval') return fileURLToPath(new URL('../node_modules/idb-keyval/dist/index.js',import.meta.url)); if(Object.hasOwn(stubs,id)) return '\0stub:'+id; if(id.startsWith('@/')) return frontend+id.slice(2).replace(/\.js$/,'.ts'); }, load(id) { if(id==='\0entry') return entry; if(id.startsWith('\0stub:')) return stubs[id.slice(6)]; } };
  const root=fileURLToPath(new URL('..',import.meta.url));
  const server=await createServer({root,configFile:false,plugins:[plugin],define:{_DEV_:'false'},server:{host:'127.0.0.1',port:0,fs:{allow:[root,frontend,process.env.MUN_ROOT ?? '/Users/kyooni18/Code/Mun']}}});
  await server.listen();
  const browser=await (process.env.ACCOUNT_BROWSER==='webkit'?webkit:chromium).launch();
  try {
    for(const fallback of [false,true]) {
      const page=await browser.newPage();
      if(fallback) await page.addInitScript(() => Object.defineProperty(window,'indexedDB',{value:undefined}));
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
      await page.waitForFunction(()=>window.write);
      await page.evaluate(()=>window.write());
      await page.reload();
      await page.waitForFunction(()=>window.read);
      const result=await page.evaluate(()=>window.read());
      assert.equal(result.me.id,'new'); assert.equal(result.me.token,'token');
      assert.deepEqual(result.accounts,[{host:new URL(page.url()).host,id:'old',username:'bob',user:{id:'old',username:'bob'},token:'old-token'},{host:new URL(page.url()).host,id:'new',username:'alice',user:{id:'new',username:'alice',notesCount:0},token:'token'}]);
      assert.deepEqual(result.worker,[{id:'old',token:'old-token'},{id:'new',token:'token'}]); assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});
