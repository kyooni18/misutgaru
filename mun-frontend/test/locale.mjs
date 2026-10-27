/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Vite loads the same TypeScript I18n class used by the Vue frontend.
test('loads the selected versioned locale and exposes Vue-compatible labels and interpolation', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { loadI18n } = await vite.ssrLoadModule('/src/services/locale.mjs');
    let requested;
    const locale = { follow: 'フォロー', unfollowConfirm: '{name}のフォローを解除しますか？' };
    const i18n = await loadI18n({ getStorage: () => ({ getItem: key => { assert.equal(key, 'lang'); return 'ja-JP'; } }), version: 'test-version', fetch: async url => { requested = url; return new Response(JSON.stringify(locale), { status: 200 }); } });
    assert.equal(requested, '/assets/locales/ja-JP.test-version.json');
    assert.equal(i18n.ts.follow, locale.follow);
    assert.equal(i18n.tsx.unfollowConfirm({ name: 'Alice' }), 'Aliceのフォローを解除しますか？');
    const fallback = await loadI18n({ getStorage: () => { throw new Error('unavailable'); }, version: 'v', fetch: async url => { requested = url; return new Response('{}', { status: 200 }); } });
    assert.equal(requested, '/assets/locales/en-US.v.json');
    assert.deepEqual(fallback.ts, {});
    await assert.rejects(loadI18n({ getStorage: () => null, version: 'v', fetch: async () => new Response(null, { status: 404 }) }), /Failed to load locale: 404/);
  } finally { await vite.close(); }
});
