/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCachedAccount } from '../src/services/cached-account.mjs';

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
