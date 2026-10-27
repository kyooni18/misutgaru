/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excludeTypesFor, mentionsRequest, markAllAsRead, notificationTypes } from '../src/services/notifications-page.mjs';

// Reference behavior from Vue pages/notifications.vue.
test('type filter excludes every other type; tabs map to notes/mentions requests', async () => {
  assert.equal(excludeTypesFor(null), null);
  const ex = excludeTypesFor('follow');
  assert.equal(ex.length, notificationTypes.length - 1);
  assert.equal(ex.includes('follow'), false);
  assert.deepEqual(mentionsRequest('directNotes'), { endpoint: 'notes/mentions', params: { visibility: 'specified' } });
  const calls = [];
  await markAllAsRead({ post: async (e, b) => calls.push([e, b]) });
  assert.deepEqual(calls, [['notifications/mark-all-as-read', {}]]);
});
