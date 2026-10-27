/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors packages/frontend/src/pages/user/index.vue and the profile header of home.vue.
export function parseAcct(acct) {
  const [username, host] = acct.replace(/^@/, '').split('@');
  return { username, host: host || null };
}

export const acctText = (user, detail = false, localHost = '') =>
  user.host ? `@${user.username}@${user.host}` : detail && localHost ? `@${user.username}@${localHost}` : `@${user.username}`;

export const fetchUser = (api, acct) => api.post('users/show', parseAcct(acct));

// Tab keys in Vue's order; achievements are local-only, reactions are public or visible to you / staff.
export function userTabs(user, me) {
  return [
    'home', 'notes', 'files', 'activity',
    ...(user.host == null ? ['achievements'] : []),
    ...((me && (me.id === user.id || me.isAdmin || me.isModerator)) || user.publicReactions ? ['reactions'] : []),
    'clips', 'lists', 'pages', 'flashs', 'gallery', 'raw',
  ];
}

export const isSelf = (user, me) => me != null && me.id === user.id;
export const showFollowsYou = (user, me) => me != null && me.id !== user.id && user.isFollowed === true;
