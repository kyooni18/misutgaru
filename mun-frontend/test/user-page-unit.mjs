/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAcct, acctText, userTabs, showFollowsYou } from '../src/services/user-page.mjs';

// Reference behavior from Vue pages/user/index.vue and home.vue.
test('acct parsing and display', () => {
  assert.deepEqual(parseAcct('@bob@x.example'), { username: 'bob', host: 'x.example' });
  assert.equal(acctText({ username: 'a', host: null }, true, 'm.example'), '@a@m.example');
  assert.equal(acctText({ username: 'a', host: 'x.example' }), '@a@x.example');
});

test('tabs: achievements only for local users, reactions when public or yours/staff', () => {
  const local = { id: 'u', host: null, publicReactions: false };
  assert.equal(userTabs(local, null).includes('reactions'), false);
  assert.equal(userTabs(local, { id: 'x', isModerator: true }).includes('reactions'), true);
  const t = userTabs({ id: 'r', host: 'x', publicReactions: true }, null);
  assert.deepEqual([t.includes('achievements'), t.includes('reactions')], [false, true]);
  assert.equal(showFollowsYou({ id: 'me', isFollowed: true }, { id: 'me' }), false);
});
