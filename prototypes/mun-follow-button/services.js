/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createFollowButtonServices } from './services-adapter.mjs';

const calls = [];
const params = new URLSearchParams(location.search);
let listener;
let resolveApi;
let rejectApi;
export let services = {
  host: 'local.test', labels: { processing: 'Processing', pending: 'Pending', following: 'Following', request: 'Request', follow: 'Follow' },
  defaultFollowWithReplies: true, alwaysConfirmFollow: false,
  login: async path => { calls.push(['login', path]); return true; }, signedIn: () => true,
  haptic: () => calls.push(['haptic']), confirm: async (type, name) => { calls.push(['confirm', type, name]); return false; },
  api: (endpoint, data) => { calls.push([endpoint, data]); return new Promise((resolve, reject) => { resolveApi = resolve; rejectApi = reject; }); },
  subscribe: fn => { listener = fn; }, dispose: () => calls.push(['dispose']),
  updateUser: user => calls.push(['update', user]), achievements: () => calls.push(['achievements']), reportError: error => calls.push(['error', String(error)]),
};
if (params.has('adapter')) {
  const original = services;
  const listeners = {};
  const ts = { processing: 'Processing', followRequestPending: 'Pending', youFollowing: 'Following', followRequest: 'Request', follow: 'Follow' };
  services = createFollowButtonServices({
    host: original.host, api: original.api, getAccount: () => ({ followingCount: 0 }),
    getPreferences: () => ({ alwaysConfirmFollow: false, defaultFollowWithReplies: true }),
    stream: { useChannel: name => {
      calls.push(['channel', name]);
      return { on: (type, fn) => { listeners[type] = fn; }, dispose: () => calls.push(['dispose']) };
    } },
    i18n: { ts, tsx: { unfollowConfirm: ({ name }) => `unfollow:${name}`, cancelFollowRequestConfirm: ({ name }) => `cancel:${name}`, followConfirm: ({ name }) => `follow:${name}` } },
    pleaseLogin: async options => { calls.push(['login', options]); return true; },
    confirm: async options => { calls.push(['confirmation', options]); return { canceled: false }; },
    haptic: original.haptic, claimAchievement: name => calls.push(['achievement', name]),
    updateUser: original.updateUser, reportError: original.reportError,
  });
  listener = user => listeners.follow(user);
}
export const full = !params.has('compact');
export const large = params.has('large');
export const user = { id: '1', username: 'alice', host: params.get('host'), isFollowing: params.get('following') === '1' ? true : params.get('following') === 'unknown' ? null : false, hasPendingFollowRequestFromYou: params.get('pending') === '1', isLocked: params.get('locked') === '1' };
export const control = { calls, services, user, emit: value => listener(value), resolve: value => resolveApi(value), reject: error => rejectApi(new Error(error)) };
