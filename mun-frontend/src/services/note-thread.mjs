/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors the thread loading of pages/note.vue, MkNoteDetailed.vue and MkNoteThreadTree.vue.
export const MAX_THREAD_DEPTH = 6;

export const fetchNote = (api, noteId) => api.post('notes/show', { noteId });

// Ancestors come newest-first from the API and are shown oldest-first. A top-level note has none.
export async function fetchConversation(api, note) {
  if (note.replyId == null) return [];
  return (await api.post('notes/conversation', { noteId: note.replyId })).reverse();
}

// Replies are shown in chronological order.
export async function fetchChildren(api, noteId) {
  return (await api.post('notes/children', { noteId, limit: 30 })).reverse();
}

// Below the depth limit replies nest inline; at the limit a "continue thread" link replaces them.
export const childMode = (child, depth, maxDepth = MAX_THREAD_DEPTH) =>
  child.repliesCount > 0 ? (depth < maxDepth ? 'nested' : 'continue') : 'leaf';

// Errors that make Vue ask the visitor to sign in instead of just showing a retry.
export const needsLogin = err => ['fbcc002d-37d9-4944-a6b0-d9e29f2d33ab', '145f88d2-b03d-4087-8143-a78928883c4b'].includes(err?.id);
