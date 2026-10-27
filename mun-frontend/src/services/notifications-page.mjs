/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors packages/frontend/src/pages/notifications.vue.
export const notificationTypes = ['note', 'follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'pollEnded', 'scheduledNotePosted', 'scheduledNotePostFailed', 'receiveFollowRequest', 'followRequestAccepted', 'app', 'roleAssigned', 'chatRoomInvitationReceived', 'achievementEarned', 'exportCompleted', 'test', 'login', 'createToken'];
export const notificationTabs = ['all', 'mentions', 'directNotes'];

// Choosing a type shows only that type, i.e. excludes all the others; null means no filter.
export function excludeTypesFor(includeType) {
  return includeType ? notificationTypes.filter(t => t !== includeType) : null;
}

export function mentionsRequest(tab) {
  return { endpoint: 'notes/mentions', params: tab === 'directNotes' ? { visibility: 'specified' } : {} };
}

export const markAllAsRead = api => api.post('notifications/mark-all-as-read', {});
