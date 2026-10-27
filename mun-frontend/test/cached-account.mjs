/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCachedAccount, refreshCachedAccount } from '../src/services/cached-account.mjs';

const read = value => readCachedAccount(() => ({ getItem: key => { assert.equal(key, 'account'); return value; } }), () => {});
test('reads cached account objects and rejects malformed or non-object values', () => {
  assert.deepEqual(read('{"id":"alice","token":"fixture-token"}'), { id: 'alice', token: 'fixture-token' });
  for (const value of [null, '', 'null', '[]', '"text"', '42', '{broken']) assert.equal(read(value), null);
});
test('continues signed out when persistent storage is unavailable', () => {
  let warnings = 0;
  assert.equal(readCachedAccount(() => { throw new Error('unavailable'); }, () => warnings++), null);
  assert.equal(warnings, 1);
});


test('refresh preserves token and account identity while replacing cached fields', async () => {
  const account = { id: 'alice', token: 'fixture-token', old: true };
  let request, saved;
  const result = await refreshCachedAccount(account, {
    fetch: async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ id: 'alice', name: 'Alice' }), { status: 200 }); },
    getStorage: () => ({ setItem: (key, value) => { saved = [key, JSON.parse(value)]; } }),
  });
  assert.deepEqual(request, { url: '/api/i', options: { method: 'POST', body: '{"i":"fixture-token"}', headers: { 'Content-Type': 'application/json' } } });
  assert.deepEqual(result, { status: 'updated' });
  assert.deepEqual(account, { id: 'alice', name: 'Alice', token: 'fixture-token' });
  assert.deepEqual(saved, ['account', account]);
});

test('refresh reports invalid or unavailable accounts without erasing the cache', async () => {
  const account = { id: 'alice', token: 'fixture-token' };
  let writes = 0;
  const storage = () => ({ setItem: () => writes++ });
  const invalid = await refreshCachedAccount(account, { fetch: async () => new Response(JSON.stringify({ error: { id: 'invalid' } }), { status: 403 }), getStorage: storage });
  assert.deepEqual(invalid, { status: 'invalid', error: { id: 'invalid' } });
  assert.deepEqual(await refreshCachedAccount(account, { fetch: async () => new Response(null, { status: 503 }), getStorage: storage }), { status: 'unavailable' });
  assert.deepEqual(await refreshCachedAccount(account, { fetch: async () => { throw new Error('offline'); }, getStorage: storage }), { status: 'unavailable' });
  assert.deepEqual(account, { id: 'alice', token: 'fixture-token' });
  assert.equal(writes, 0);
});

test('a late refresh cannot overwrite a changed account token', async () => {
  const account = { id: 'alice', token: 'fixture-token' };
  let finish;
  const result = refreshCachedAccount(account, { fetch: () => new Promise(resolve => { finish = resolve; }) });
  account.token = 'new-fixture-token';
  finish(new Response(JSON.stringify({ id: 'old' }), { status: 200 }));
  assert.deepEqual(await result, { status: 'stale' });
  assert.deepEqual(account, { id: 'alice', token: 'new-fixture-token' });
  const invalid = refreshCachedAccount(account, { fetch: () => new Promise(resolve => { finish = resolve; }) });
  account.token = 'newer-fixture-token';
  finish(new Response(JSON.stringify({ error: { id: 'invalid' } }), { status: 403 }));
  assert.deepEqual(await invalid, { status: 'stale' });
});


test('storage failure keeps refreshed data in memory and signed-out sessions do not fetch', async () => {
  const account = { id: 'alice', token: 'fixture-token' };
  let warnings = 0;
  const result = await refreshCachedAccount(account, {
    fetch: async () => new Response(JSON.stringify({ id: 'alice', name: 'Updated' }), { status: 200 }),
    getStorage: () => { throw new Error('unavailable'); }, warn: () => warnings++,
  });
  assert.deepEqual(result, { status: 'updated' });
  assert.deepEqual(account, { id: 'alice', name: 'Updated', token: 'fixture-token' });
  assert.equal(warnings, 1);
  assert.deepEqual(await refreshCachedAccount(null, { fetch: () => { throw new Error('should not fetch'); } }), { status: 'signed-out' });
});
