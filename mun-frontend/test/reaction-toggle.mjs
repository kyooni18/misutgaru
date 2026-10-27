/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleReaction } from '../src/services/reaction-toggle.mjs';

function setup({ signedIn = true, confirm = true, confirmOnReact = false } = {}) {
  const calls = [], asked = [];
  const services = {
    signedIn: () => signedIn, confirmOnReact,
    confirm: async (kind, reaction) => { asked.push([kind, reaction]); return confirm; },
    api: { post: async (endpoint, body) => { calls.push([endpoint, body]); } },
  };
  return { services, calls, asked };
}

// Reference behavior from Vue MkReactionsViewer.reaction.vue toggleReaction.
test('reacting without an existing reaction creates one, confirming only when configured', async () => {
  const a = setup();
  assert.deepEqual(await toggleReaction({ services: a.services, noteId: 'n', reaction: '👍', myReaction: null, reactions: { '👍': 1 } }), { myReaction: '👍', reactions: { '👍': 2 } });
  assert.deepEqual(a.calls, [['notes/reactions/create', { noteId: 'n', reaction: '👍' }]]);
  assert.deepEqual(a.asked, []);
  const b = setup({ confirmOnReact: true, confirm: false });
  assert.equal(await toggleReaction({ services: b.services, noteId: 'n', reaction: '👍', myReaction: null, reactions: {} }), null);
  assert.deepEqual(b.asked, [['react', '👍']]);
  assert.deepEqual(b.calls, []);
});

test('clicking your own reaction asks to cancel, then deletes it and drops empty counts', async () => {
  const a = setup();
  const res = await toggleReaction({ services: a.services, noteId: 'n', reaction: '👍', myReaction: '👍', reactions: { '👍': 1, '❤': 2 } });
  assert.deepEqual(res, { myReaction: null, reactions: { '❤': 2 } });
  assert.deepEqual(a.asked, [['cancel', '👍']]);
  assert.deepEqual(a.calls, [['notes/reactions/delete', { noteId: 'n' }]]);
});

test('clicking another reaction asks to change, deletes the old one then creates the new one', async () => {
  const a = setup();
  const res = await toggleReaction({ services: a.services, noteId: 'n', reaction: '❤', myReaction: '👍', reactions: { '👍': 2, '❤': 1 } });
  assert.deepEqual(res, { myReaction: '❤', reactions: { '👍': 1, '❤': 2 } });
  assert.deepEqual(a.asked, [['change', '❤']]);
  assert.deepEqual(a.calls.map(c => c[0]), ['notes/reactions/delete', 'notes/reactions/create']);
});

test('visitors and declined confirmations change nothing', async () => {
  const visitor = setup({ signedIn: false });
  assert.equal(await toggleReaction({ services: visitor.services, noteId: 'n', reaction: '👍', myReaction: null, reactions: {} }), null);
  assert.deepEqual(visitor.calls, []);
  const declined = setup({ confirm: false });
  assert.equal(await toggleReaction({ services: declined.services, noteId: 'n', reaction: '👍', myReaction: '👍', reactions: { '👍': 1 } }), null);
  assert.deepEqual(declined.calls, []);
});
