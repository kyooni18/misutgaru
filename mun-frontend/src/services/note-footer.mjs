/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Footer rules mirrored from packages/frontend/src/composables/use-note.ts and MkNote.vue.
export function canRenote(note, account) {
  return ['public', 'home'].includes(note.visibility) || (note.visibility === 'followers' && account != null && note.userId === account.id);
}

export function reactionCount(reactions) {
  return Object.values(reactions ?? {}).reduce((sum, n) => sum + n, 0);
}

// Which icon the react button shows: heart variants for likeOnly notes, minus when you already reacted, plus otherwise.
export function reactIcon(note, myReaction) {
  if (note.reactionAcceptance === 'likeOnly') return myReaction != null ? 'heart-filled' : 'heart';
  return myReaction != null ? 'minus' : 'plus';
}

export function showReactionCount(note, showReactionsCount, count) {
  return (note.reactionAcceptance === 'likeOnly' || showReactionsCount) && count > 0;
}
