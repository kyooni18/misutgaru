/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { createFollowButtonServices } from './services-adapter.mjs';

const events = [];
const listeners = {};
let account = { followingCount: 100 };
const prefs = { alwaysConfirmFollow: false, defaultFollowWithReplies: true };
const texts = { processing: 'Processing', followRequestPending: 'Pending', youFollowing: 'Following', followRequest: 'Request', follow: 'Follow' };
const adapter = createFollowButtonServices({
  host: 'local.test', api: () => {}, getAccount: () => account, getPreferences: () => prefs,
  stream: { useChannel(name) { events.push(['channel', name]); return { on(type, fn) { listeners[type] = fn; }, dispose() { events.push(['dispose']); } }; } },
  i18n: { ts: texts, tsx: { unfollowConfirm: ({ name }) => `unfollow:${name}`, cancelFollowRequestConfirm: ({ name }) => `cancel:${name}`, followConfirm: ({ name }) => `follow:${name}` } },
  pleaseLogin: async options => { events.push(['login', options]); return false; },
  confirm: async options => { events.push(['confirm', options]); return { canceled: true }; },
  haptic: () => {}, claimAchievement: name => events.push(['achievement', name]), updateUser: () => {},
});
assert.equal(await adapter.login('/@alice@remote.test'), false);
assert.deepEqual(events.shift(), ['login', { openOnRemote: { type: 'web', path: '/@alice@remote.test' } }]);
for (const [kind, type] of [['unfollow', 'warning'], ['cancel', 'question'], ['follow', 'question']]) {
  assert.equal(await adapter.confirm(kind, 'Alice'), true);
  assert.deepEqual(events.shift(), ['confirm', { type, text: `${kind}:Alice` }]);
}
const received = [];
adapter.subscribe(user => received.push(user));
assert.deepEqual(events.shift(), ['channel', 'main']);
listeners.follow({ id: 'one' }); listeners.unfollow({ id: 'two' });
assert.deepEqual(received, [{ id: 'one' }, { id: 'two' }]);
adapter.dispose(); assert.deepEqual(events.shift(), ['dispose']);
adapter.achievements();
assert.deepEqual(events.splice(0), ['following1', 'following10', 'following50', 'following100'].map(name => ['achievement', name]));
account = null; adapter.achievements(); assert.deepEqual(events, []); assert.equal(adapter.signedIn(), false);
prefs.alwaysConfirmFollow = true; prefs.defaultFollowWithReplies = false;
assert.equal(adapter.alwaysConfirmFollow, true); assert.equal(adapter.defaultFollowWithReplies, false);
texts.follow = 'Changed'; assert.equal(adapter.labels.follow, 'Changed');
console.log('PASS: follow service adapter login, confirmation, channel lifetime, achievements and live settings');
