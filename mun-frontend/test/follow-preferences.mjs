/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createFollowPreferences } from '../src/services/follow-preferences.mjs';

test('local follow preferences select the same records as Vue', async () => {
  const stubs = {
    vue: 'export const ref = value => ({value}); export const customRef = () => {}; export const watch = () => {}; export const onScopeDispose = () => {};',
    eventemitter3: 'export class EventEmitter {}',
    '@@/js/config.js': 'export const host="example.test", version="test"',
    './def.js': 'export const PREF_DEF={alwaysConfirmFollow:{default:true},defaultFollowWithReplies:{default:false},animation:{default:true}}',
    '@/utility/id.js': 'export const genId=()=>"id"',
    '@/utility/copy-to-clipboard.js': 'export const copyToClipboard=()=>{}',
    '@/i18n.js': 'export const i18n={}',
    '@/os.js': 'export const alert=()=>{}',
    '@/utility/deep-equal.js': 'export const deepEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b)',
    '@/utility/clone.js': 'export const deepClone=x=>structuredClone(x)',
  };
  const plugin = { name: 'preferences-reference-stubs', enforce: 'pre', resolveId(id) { if (Object.hasOwn(stubs, id)) return '\0pref:' + id; }, load(id) { if (id.startsWith('\0pref:')) return stubs[id.slice(6)]; } };
  const server = await createServer({ configFile: false, plugins: [plugin], server: { middlewareMode: true, hmr: false }, appType: 'custom', define: { _DEV_: 'false' } });
  try {
    const source = fileURLToPath(new URL('../../packages/frontend/src/preferences/manager.ts', import.meta.url));
    const { PreferencesManager } = await server.ssrLoadModule(source);
    const profile = { type: 'main', id: 'p', version: 'test', modifiedAt: 1, name: '', preferences: {
      alwaysConfirmFollow: [[{}, true, {}], [{ server: 'example.test' }, false, {}], [{ server: 'example.test', account: 'a' }, true, {}]],
      defaultFollowWithReplies: [[{ device: 'other' }, true, {}], [{ server: 'example.test', account: 'a' }, false, {}]],
      animation: [],
    } };
    for (const account of [null, { id: 'a' }, { id: 'b' }]) {
      const reference = new PreferencesManager({ load: () => structuredClone(profile), save() {}, cloudGetBulk: async () => ({}) }, account);
      const native = createFollowPreferences({ host: 'example.test', account, getStorage: () => ({ getItem: () => JSON.stringify(profile) }) });
      assert.deepEqual(native.read(), reference.s);
      await reference.cloudReady;
    }
    let saved = '{bad';
    const native = createFollowPreferences({ host: 'example.test', account: null, prefersReducedMotion: true, getStorage: () => ({ getItem: () => saved }) });
    assert.deepEqual(native.read(), { alwaysConfirmFollow: true, defaultFollowWithReplies: false, animation: false });
    saved = JSON.stringify(profile);
    native.reload();
    assert.deepEqual(native.read(), { alwaysConfirmFollow: true, defaultFollowWithReplies: true, animation: false });
  } finally { await server.close(); }
});
