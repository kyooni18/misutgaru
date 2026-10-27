/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */


const calls = [];
const params = new URLSearchParams(location.search);
let listener;
let resolveApi;
let rejectApi;
export const services = {
  host: 'local.test', labels: { processing: 'Processing', pending: 'Pending', following: 'Following', request: 'Request', follow: 'Follow' },
  defaultFollowWithReplies: true, alwaysConfirmFollow: false,
  login: async path => { calls.push(['login', path]); return true; }, signedIn: () => true,
  haptic: () => calls.push(['haptic']), confirm: async (type, name) => { calls.push(['confirm', type, name]); return false; },
  api: (endpoint, data) => { calls.push([endpoint, data]); return new Promise((resolve, reject) => { resolveApi = resolve; rejectApi = reject; }); },
  subscribe: fn => { listener = fn; }, dispose: () => calls.push(['dispose']),
  updateUser: user => calls.push(['update', user]), achievements: () => calls.push(['achievements']), reportError: error => calls.push(['error', String(error)]),
};
export const user = { id: '1', username: 'alice', host: null, isFollowing: params.get('following') === '1' ? true : params.get('following') === 'unknown' ? null : false, hasPendingFollowRequestFromYou: params.get('pending') === '1', isLocked: params.get('locked') === '1' };
export const control = { calls, services, user, emit: value => listener(value), resolve: value => resolveApi(value), reject: error => rejectApi(new Error(error)) };
