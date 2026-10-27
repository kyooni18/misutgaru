/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors react()/undoReact()/toggleReact in packages/frontend/src/composables/use-note.ts.
// services: login(noteId), pickReaction(note) -> reaction|null, confirm('react', reaction), confirmOnReact, api.post.
// Resolves to the reaction that was created, '' after an undo, or null when nothing happened.
export async function reactToNote({ services, note }) {
  if (!(await services.login(note.id))) return null;
  if (note.reactionAcceptance === 'likeOnly') {
    await services.api.post('notes/reactions/create', { noteId: note.id, reaction: '❤️' });
    return '❤️';
  }
  const reaction = await services.pickReaction(note);
  if (!reaction) return null;
  if (services.confirmOnReact && !(await services.confirm('react', reaction))) return null;
  await services.api.post('notes/reactions/create', { noteId: note.id, reaction });
  return reaction;
}

export async function toggleReactNote({ services, note, myReaction }) {
  if (myReaction == null) return reactToNote({ services, note });
  await services.api.post('notes/reactions/delete', { noteId: note.id });
  return '';
}
