/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeNotification, getNoteSummary, answerFollowRequest } from '../src/services/notification-view.mjs';

const labels = {
  t: { newNote: 'New note', roleAssigned: 'Role assigned', login: 'Login' },
  deletedNote: 'deleted', invisibleNote: 'invisible', poll: 'Poll', withNFiles: n => n + ' files',
  likedBySomeUsers: n => n + ' liked', reactedBySomeUsers: n => n + ' reacted', renotedBySomeUsers: n => n + ' renoted',
  youGotNewFollower: 'New follower', receiveFollowRequest: 'Follow request', followRequestAccepted: 'Accepted',
  exportOfXCompleted: x => 'Export of ' + x, exportEntityName: { note: 'Notes' }, showFile: 'Show file',
  achievementTitle: a => 'A:' + a, createTokenDescription: 'Token', notificationWillBeDisplayedLikeThis: 'Like this',
};
const alice = { id: 'a', username: 'alice', host: null, name: 'Alice' };
const bob = { id: 'b', username: 'bob', host: 'x.example', name: null };
const me = { id: 'me', username: 'me' };

// Reference behavior from Vue MkNotification.vue and get-note-summary.ts.
test('note summary uses cw over text and appends files, poll, reply and renote markers', () => {
  assert.equal(getNoteSummary({ cw: 'cw', text: 'hidden', files: [1, 2], poll: {}, replyId: 'r', renoteId: 'n' }, labels), 'cw (2 files) (Poll)\n\nRE: ...\n\nRN: ...');
  assert.equal(getNoteSummary({ deletedAt: 'x' }, labels), '(deleted)');
  assert.equal(getNoteSummary(null, labels), '');
});

test('user notifications link the user, show the note summary and point at the note', () => {
  const v = describeNotification({ type: 'reply', user: alice, note: { id: 'n1', text: 'hi' } }, me, labels);
  assert.deepEqual([v.avatar, v.headerUser, v.body, v.href, v.subIcon], [alice, alice, 'hi', '/notes/n1', 'arrow-back-up']);
  const r = describeNotification({ type: 'renote', user: bob, note: { id: 'n2', renote: { text: 'orig' } } }, me, labels);
  assert.deepEqual([r.body, r.href], ['orig', '/notes/n2']);
  const x = describeNotification({ type: 'reaction', user: alice, reaction: ':blob:', note: { id: 'n3', text: 't' } }, me, labels);
  assert.equal(x.reaction, ':blob@.:');
});

test('grouped notifications count distinct reacting users and keep per-user rows', () => {
  const n = { type: 'reaction:grouped', note: { id: 'n', text: 't', reactionAcceptance: 'likeOnly' }, reactions: [{ user: alice, reaction: '❤' }, { user: alice, reaction: '👍' }, { user: bob, reaction: '❤' }] };
  const v = describeNotification(n, me, labels);
  assert.deepEqual([v.headerText, v.groupIcon, v.reactions.length], ['2 liked', 'heart', 3]);
  assert.equal(describeNotification({ type: 'renote:grouped', note: { id: 'n', renote: {} }, users: [alice, bob] }, me, labels).headerText, '2 renoted');
});

test('system notifications show your own avatar; follow requests answer through following/requests', async () => {
  assert.equal(describeNotification({ type: 'login' }, me, labels).avatar, me);
  assert.equal(describeNotification({ type: 'login' }, me, labels).headerText, 'Login');
  assert.equal(describeNotification({ type: 'note', note: { id: 'n', user: bob, text: 'x' } }, me, labels).headerText, 'New note: bob');
  const v = describeNotification({ type: 'receiveFollowRequest', user: alice }, me, labels);
  assert.equal(v.followRequest, true);
  const calls = [];
  await answerFollowRequest({ post: async (e, b) => calls.push([e, b]) }, { user: alice }, true);
  await answerFollowRequest({ post: async (e, b) => calls.push([e, b]) }, { user: alice }, false);
  assert.deepEqual(calls, [['following/requests/accept', { userId: 'a' }], ['following/requests/reject', { userId: 'a' }]]);
});
