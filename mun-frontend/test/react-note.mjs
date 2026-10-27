/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reactToNote, toggleReactNote } from '../src/services/react-note.mjs';

function setup({ login = true, pick = '👍', confirm = true, confirmOnReact = false } = {}) {
  const calls = [];
  return { calls, services: { login: async () => login, pickReaction: async () => pick, confirm: async () => confirm, confirmOnReact, api: { post: async (e, b) => { calls.push([e, b]); } } } };
}
const note = { id: 'n', reactionAcceptance: null };

// Reference behavior from Vue use-note.ts react()/toggleReact().
test('picked reaction is created; cancelled picker, declined confirm and failed login do nothing', async () => {
  const a = setup();
  assert.equal(await reactToNote({ services: a.services, note }), '👍');
  assert.deepEqual(a.calls, [['notes/reactions/create', { noteId: 'n', reaction: '👍' }]]);
  for (const o of [{ pick: null }, { confirmOnReact: true, confirm: false }, { login: false }]) {
    const b = setup(o);
    assert.equal(await reactToNote({ services: b.services, note }), null);
    assert.deepEqual(b.calls, []);
  }
});

test('likeOnly notes skip the picker and send a heart', async () => {
  const a = setup({ pick: null });
  assert.equal(await reactToNote({ services: a.services, note: { id: 'n', reactionAcceptance: 'likeOnly' } }), '❤️');
  assert.deepEqual(a.calls[0][1], { noteId: 'n', reaction: '❤️' });
});

test('toggle undoes an existing reaction without asking', async () => {
  const a = setup();
  assert.equal(await toggleReactNote({ services: a.services, note, myReaction: '👍' }), '');
  assert.deepEqual(a.calls, [['notes/reactions/delete', { noteId: 'n' }]]);
});
