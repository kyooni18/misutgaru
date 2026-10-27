/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors packages/frontend/src/pages/user/index.timeline.vue: the endpoint and params for each tab.
export const userTimelineTabs = ['featured', 'notes', 'all', 'files'];

export function userTimelineRequest(userId, tab) {
  if (tab === 'featured') return { endpoint: 'users/featured-notes', params: { userId } };
  return {
    endpoint: 'users/notes',
    params: { userId, withRenotes: tab === 'all', withReplies: tab === 'all', withChannelNotes: tab === 'all', withFiles: tab === 'files' },
  };
}
