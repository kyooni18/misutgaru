/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Mirrors the navigation rules of MkLightbox.vue and utility/lightbox.ts.
export function getType(mime) {
  if (mime.startsWith('image')) return 'image';
  if (mime.startsWith('video')) return 'video';
  if (mime.startsWith('audio')) return 'audio';
  throw new Error(`Unsupported file type: ${mime}`);
}

export function toContents(files) {
  return files.map(f => ({ id: f.id, type: getType(f.type), url: f.url, thumbnailUrl: f.thumbnailUrl, filename: f.name, file: f }));
}

export const nextIndex = (index, count) => Math.min(index + 1, count - 1);
export const prevIndex = (index) => Math.max(index - 1, 0);

// Escape closes; arrows move (and may repeat).
export function keyAction(key) {
  return key === 'Escape' ? 'close' : key === 'ArrowLeft' ? 'prev' : key === 'ArrowRight' ? 'next' : null;
}
