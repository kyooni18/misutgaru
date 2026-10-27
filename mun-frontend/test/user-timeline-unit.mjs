/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userTimelineRequest } from '../src/services/user-timeline.mjs';

// Reference behavior from Vue pages/user/index.timeline.vue.
test('each tab maps to Vue paginator endpoint and params', () => {
  assert.deepEqual(userTimelineRequest('u', 'featured'), { endpoint: 'users/featured-notes', params: { userId: 'u' } });
  assert.deepEqual(userTimelineRequest('u', 'all').params, { userId: 'u', withRenotes: true, withReplies: true, withChannelNotes: true, withFiles: false });
  assert.deepEqual(userTimelineRequest('u', 'notes').params, { userId: 'u', withRenotes: false, withReplies: false, withChannelNotes: false, withFiles: false });
  assert.equal(userTimelineRequest('u', 'files').params.withFiles, true);
});
