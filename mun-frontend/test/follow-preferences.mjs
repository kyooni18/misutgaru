/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createFollowPreferences, observeFollowPreferences } from '../src/services/follow-preferences.mjs';

test('follow preferences select and synchronize the same values as Vue', async () => {
  const stubs = {
    vue: 'export const ref = value => ({value}); export const customRef = () => {}; export const watch = () => {}; export const onScopeDispose = () => {};',
    eventemitter3: 'export class EventEmitter {}',
    '@@/js/config.js': 'export const host="example.test", version="test"',
    './def.js': 'export const PREF_DEF={alwaysConfirmFollow:{default:true},defaultFollowWithReplies:{default:false},animation:{default:true},"experimental.enableHapticFeedback":{default:false}}',
    '@/utility/id.js': 'export const genId=()=>"id"',
    '@/utility/copy-to-clipboard.js': 'export const copyToClipboard=()=>{}',
    '@/i18n.js': 'export const i18n={}',
    '@/os.js': 'export const alert=()=>{}',
    '@/utility/deep-equal.js': 'export const deepEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b)',
    '@/utility/clone.js': 'export const deepClone=x=>structuredClone(x)',
  };
  const plugin = { name: 'preferences-reference-stubs', enforce: 'pre', resolveId(id) { if (Object.hasOwn(stubs, id)) return '\0pref:' + id; }, load(id) { if (id.startsWith('\0pref:')) return stubs[id.slice(6)]; } };
  const server = await createServer({ configFile: false, plugins: [plugin], server: { middlewareMode: true, ws: false }, appType: 'custom', define: { _DEV_: 'false' } });
  try {
    const source = fileURLToPath(new URL('../../packages/frontend/src/preferences/manager.ts', import.meta.url));
    const { PreferencesManager } = await server.ssrLoadModule(source);
    const profile = { type: 'main', id: 'p', version: 'test', modifiedAt: 1, name: '', preferences: {
      alwaysConfirmFollow: [[{}, true, {}], [{ server: 'example.test' }, false, {}], [{ server: 'example.test', account: 'a' }, true, {}]],
      defaultFollowWithReplies: [[{ device: 'other' }, true, {}], [{ server: 'example.test', account: 'a' }, false, {}]],
      animation: [],
      'experimental.enableHapticFeedback': [[{}, false, {}], [{ server: 'example.test' }, true, {}], [{ server: 'example.test', account: 'a' }, false, {}]],
    } };
    for (const account of [null, { id: 'a' }, { id: 'b' }]) {
      const reference = new PreferencesManager({ load: () => structuredClone(profile), save() {}, cloudGetBulk: async () => ({}) }, account);
      const native = createFollowPreferences({ host: 'example.test', account, getStorage: () => ({ getItem: () => JSON.stringify(profile) }) });
      assert.deepEqual(native.read(), reference.s);
      await reference.cloudReady;
    }
    const cloudProfile = structuredClone(profile);
    cloudProfile.preferences.alwaysConfirmFollow[2][2].sync = true;
    cloudProfile.preferences.defaultFollowWithReplies[1][2].sync = true;
    const account = { id: 'a' };
    const reference = new PreferencesManager({ load: () => structuredClone(cloudProfile), save() {}, cloudGetBulk: async () => ({ alwaysConfirmFollow: false }) }, account);
    const cloudNative = createFollowPreferences({ host: 'example.test', account, getStorage: () => ({ getItem: () => JSON.stringify(cloudProfile) }) });
    const requests = [];
    await cloudNative.sync(async (endpoint, data) => {
      requests.push([endpoint, data]);
      if (data.key.endsWith('defaultFollowWithReplies')) throw { code: 'NO_SUCH_KEY' };
      return [[{}, true], [{ server: 'example.test', account: 'a' }, false]];
    });
    await reference.cloudReady;
    assert.deepEqual(cloudNative.read(), reference.s);
    assert.deepEqual(requests.map(([, data]) => data.key), ['default:alwaysConfirmFollow', 'default:defaultFollowWithReplies']);
    assert.ok(requests.every(([endpoint, data]) => endpoint === 'i/registry/get' && data.scope.join('/') === 'client/preferences/sync'));
    const resolvers = [];
    const pending = cloudNative.sync(() => new Promise(resolve => { resolvers.push(resolve); }));
    cloudNative.reload();
    resolvers.forEach(resolve => resolve([[{ server: 'example.test', account: 'a' }, false]]));
    await pending;
    assert.equal(cloudNative.read().alwaysConfirmFollow, true);
    let saved = '{bad';
    const native = createFollowPreferences({ host: 'example.test', account: null, prefersReducedMotion: true, getStorage: () => ({ getItem: () => saved }) });
    assert.deepEqual(native.read(), { alwaysConfirmFollow: true, defaultFollowWithReplies: false, animation: false, 'experimental.enableHapticFeedback': false });
    saved = JSON.stringify(profile);
    native.reload();
    assert.deepEqual(native.read(), { alwaysConfirmFollow: true, defaultFollowWithReplies: true, animation: false, 'experimental.enableHapticFeedback': false });
    let listener, closed = false;
    const channel = { addEventListener(type, fn) { listener = fn; }, removeEventListener(type, fn) { assert.equal(fn, listener); }, close() { closed = true; } };
    const stop = observeFollowPreferences({ preferences: native, api: async () => [], channel });
    const updated = structuredClone(profile);
    updated.preferences.alwaysConfirmFollow[0][1] = false;
    saved = JSON.stringify(updated);
    listener({ type: 'preferencesUpdate', tabId: 'other', timestamp: 20 });
    assert.equal(native.read().alwaysConfirmFollow, false);
    saved = JSON.stringify(profile);
    listener({ type: 'preferencesUpdate', tabId: 'older', timestamp: 19 });
    assert.equal(native.read().alwaysConfirmFollow, false);
    saved = '{bad';
    listener({ type: 'preferencesUpdate', tabId: 'other', timestamp: 21 });
    assert.equal(native.read().alwaysConfirmFollow, false);
    stop();
    assert.equal(closed, true);
  } finally { await server.close(); }
});
