/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { labels, formatTime, api, services } from './note-simple-props.js';
import { userLabels } from './user-timeline-props.js';

export const pageLabels = {
  ...userLabels, followsYou: 'Follows you', notes: 'Notes', following: 'Following', followers: 'Followers',
  userTabs: Object.fromEntries(['home', 'notes', 'files', 'activity', 'achievements', 'reactions', 'clips', 'lists', 'pages', 'flashs', 'gallery', 'raw'].map(k => [k, 'tab:' + k])),
};
export const me = window.fixtureMe ?? null;
export const followServices = {
  host: 'm.example', labels: { processing: '...', pending: 'Pending', following: 'Following', request: 'Request', follow: 'Follow' },
  api: async () => ({}), haptic() {}, updateUser() {}, reportError() {}, alwaysConfirmFollow: false, defaultFollowWithReplies: false,
  signedIn: () => me != null, login: async () => true, confirm: async () => false, subscribe() {}, dispose() {}, achievements() {},
};
export { formatTime, api, services };
