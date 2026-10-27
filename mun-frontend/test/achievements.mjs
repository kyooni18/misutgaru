/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createAchievementClaimer } from '../src/services/achievements.mjs';

test('achievement claims match Vue deduplication, pacing, and API requests', async () => {
  const stubs = {
    '@/i.js': 'export const $i=globalThis.__achievementAccount',
    '@/utility/misskey-api.js': 'export const misskeyApi=(endpoint,data)=>globalThis.__achievementApi(endpoint,data)',
  };
  const plugin = { name: 'achievement-reference-stubs', enforce: 'pre', resolveId(id) { if (Object.hasOwn(stubs, id)) return '\0achievement:' + id; }, load(id) { if (id.startsWith('\0achievement:')) return stubs[id.slice(13)]; } };
  const server = await createServer({ configFile: false, plugins: [plugin], server: { middlewareMode: true, ws: false }, appType: 'custom', define: { _DEV_: 'false' } });
  const account = { achievements: [{ name: 'following1' }], movedTo: null };
  const oldWindow = globalThis.window;
  try {
    const run = async makeClaim => {
      const timers = [], calls = [];
      const schedule = (fn, delay) => { timers.push({ fn, delay }); };
      globalThis.window = { setTimeout: schedule };
      globalThis.__achievementAccount = account;
      globalThis.__achievementApi = (endpoint, data) => { calls.push([endpoint, data]); return Promise.resolve(); };
      const claim = await makeClaim(schedule);
      const first = claim('following10');
      const second = claim('following50');
      await claim('following10');
      await claim('following1');
      assert.deepEqual(timers.map(timer => timer.delay), [0, 500]);
      timers.shift().fn();
      await Promise.resolve();
      timers.shift().fn();
      await Promise.all([first, second]);
      return { calls, cleanupDelays: timers.map(timer => timer.delay) };
    };
    const source = fileURLToPath(new URL('../../packages/frontend/src/utility/achievements.ts', import.meta.url));
    const reference = await run(async () => (await server.ssrLoadModule(source)).claimAchievement);
    const native = await run(async schedule => createAchievementClaimer({ account, api: globalThis.__achievementApi, setTimeout: schedule }));
    assert.deepEqual(native, reference);
    assert.deepEqual(native.calls, [['i/claim-achievement', { name: 'following10' }], ['i/claim-achievement', { name: 'following50' }]]);
    account.movedTo = 'elsewhere';
    const blocked = createAchievementClaimer({ account, api: () => { throw new Error('unexpected claim'); } });
    await blocked('following300');
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    delete globalThis.__achievementAccount;
    delete globalThis.__achievementApi;
    await server.close();
  }
});
