/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchConversation, fetchChildren, childMode, needsLogin } from '../src/services/note-thread.mjs';

const api = (calls, res) => ({ post: async (e, b) => { calls.push([e, b]); return res; } });

// Reference behavior from Vue pages/note.vue, MkNoteDetailed.vue and MkNoteThreadTree.vue.
test('conversation loads ancestors of the parent oldest-first; top-level notes skip the request', async () => {
  const calls = [];
  assert.deepEqual(await fetchConversation(api(calls, [{ id: 'p2' }, { id: 'p1' }]), { replyId: 'p3' }), [{ id: 'p1' }, { id: 'p2' }]);
  assert.deepEqual(calls, [['notes/conversation', { noteId: 'p3' }]]);
  assert.deepEqual(await fetchConversation(api(calls, []), { replyId: null }), []);
  assert.equal(calls.length, 1);
});

test('children load 30 at a time in chronological order, nest until depth 6 then link to the thread', async () => {
  const calls = [];
  assert.deepEqual(await fetchChildren(api(calls, [{ id: 'b' }, { id: 'a' }]), 'n'), [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(calls, [['notes/children', { noteId: 'n', limit: 30 }]]);
  assert.deepEqual([childMode({ repliesCount: 0 }, 1), childMode({ repliesCount: 2 }, 5), childMode({ repliesCount: 2 }, 6)], ['leaf', 'nested', 'continue']);
});

test('only the two sign-in-required error ids ask the visitor to sign in', () => {
  assert.equal(needsLogin({ id: 'fbcc002d-37d9-4944-a6b0-d9e29f2d33ab' }), true);
  assert.equal(needsLogin({ id: 'other' }), false);
});
