/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors toggleReaction in packages/frontend/src/components/MkReactionsViewer.reaction.vue.
// services: signedIn(), confirm(kind, reaction) -> Promise<boolean>, confirmOnReact, api.post.
// Resolves to { myReaction, reactions } after a change, or null when nothing changed.
export async function toggleReaction({ services, noteId, reaction, myReaction, reactions }) {
  if (!services.signedIn()) return null;
  const next = { ...reactions };
  const decrement = key => { next[key] = (next[key] ?? 1) - 1; if (next[key] <= 0) delete next[key]; };
  if (myReaction) {
    if (!(await services.confirm(myReaction !== reaction ? 'change' : 'cancel', reaction))) return null;
    await services.api.post('notes/reactions/delete', { noteId });
    decrement(myReaction);
    if (myReaction === reaction) return { myReaction: null, reactions: next };
    await services.api.post('notes/reactions/create', { noteId, reaction });
    next[reaction] = (next[reaction] ?? 0) + 1;
    return { myReaction: reaction, reactions: next };
  }
  if (services.confirmOnReact && !(await services.confirm('react', reaction))) return null;
  await services.api.post('notes/reactions/create', { noteId, reaction });
  next[reaction] = (next[reaction] ?? 0) + 1;
  return { myReaction: reaction, reactions: next };
}
