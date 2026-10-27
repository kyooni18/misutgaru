/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { labels, formatTime, api, services } from './note-simple-props.js';

export const me = { id: 'me', username: 'me', name: 'Me', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };
export const nLabels = {
  ...labels, noNotifications: 'No notifications', accept: 'Accept', reject: 'Reject',
  t: { newNote: 'New note', login: 'Login' }, deletedNote: 'deleted', invisibleNote: 'invisible', withNFiles: n => n + ' files',
  likedBySomeUsers: n => n + ' liked', reactedBySomeUsers: n => n + ' reacted', renotedBySomeUsers: n => n + ' renoted',
  youGotNewFollower: 'New follower', receiveFollowRequest: 'Follow request', followRequestAccepted: 'Accepted',
};
export { formatTime, api, services };
export const excludeTypes = null;
export const grouped = false;
