/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPostPayload, canPost } from '../src/services/post-payload.mjs';

const base = { text: 'hi', visibility: 'public', localOnly: false, reactionAcceptance: null };

// Reference behavior from Vue MkPostForm.vue post().
test('payload nulls empty text and cw, and only sends optional ids when present', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(buildPostPayload({ ...base, text: '' }))), { text: null, poll: null, cw: null, localOnly: false, visibility: 'public', reactionAcceptance: null });
  const p = buildPostPayload({ ...base, files: [{ id: 'f1' }], reply: { id: 'r' }, channel: { id: 'c' }, useCw: true, cw: undefined });
  assert.deepEqual([p.fileIds, p.replyId, p.channelId, p.cw], [['f1'], 'r', 'c', '']);
  assert.equal(buildPostPayload({ ...base, renote: { id: 'n' }, quoteId: 'q' }).renoteId, 'n');
  assert.equal(buildPostPayload({ ...base, quoteId: 'q' }).renoteId, 'q');
});

test('specified visibility forces localOnly off and sends visibleUserIds', () => {
  const p = buildPostPayload({ ...base, visibility: 'specified', localOnly: true, visibleUsers: [{ id: 'u1' }] });
  assert.equal(p.localOnly, false);
  assert.deepEqual(p.visibleUserIds, ['u1']);
  assert.equal(buildPostPayload({ ...base, localOnly: true }).localOnly, true);
});

test('hashtags go on the last line, prefixed with # and a space unless that line is blank', () => {
  const h = { ...base, withHashtags: true, hashtags: 'a #b' };
  assert.equal(buildPostPayload({ ...h, text: 'x\ny' }).text, 'x\ny #a #b');
  assert.equal(buildPostPayload({ ...h, text: 'x\n' }).text, 'x\n#a #b');
  assert.equal(buildPostPayload({ ...h, text: '' }).text, '#a #b');
  assert.equal(buildPostPayload({ ...h, withHashtags: false }).text, 'hi');
});

test('canPost needs content, respects limits and cw/poll rules', () => {
  assert.equal(canPost({ text: '' }), false);
  assert.equal(canPost({ text: 'a' }), true);
  assert.equal(canPost({ text: '', renote: { id: 'n' } }), true);
  assert.equal(canPost({ text: 'a'.repeat(1001) }), false);
  assert.equal(canPost({ text: 'a', useCw: true, cw: ' ' }), false);
  assert.equal(canPost({ text: 'a', useCw: true, cw: 'x' }), true);
  assert.equal(canPost({ text: 'a', poll: { choices: ['1'] } }), false);
  assert.equal(canPost({ text: 'a', posting: true }), false);
});
