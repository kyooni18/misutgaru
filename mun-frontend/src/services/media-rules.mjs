/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { FILE_TYPE_BROWSERSAFE } from '../../../packages/frontend-shared/js/const.ts';

// Mirrors packages/frontend/src/utility/lightbox.ts isPreviewable.
export function isPreviewable(mime) {
  if (mime === 'image/svg+xml') return true;
  const stripped = mime.split(';')[0].trim();
  return (stripped.startsWith('image') || stripped.startsWith('video') || stripped.startsWith('audio')) && FILE_TYPE_BROWSERSAFE.includes(stripped);
}

export function splitMedia(files) {
  const previewable = [];
  const nonPreviewable = [];
  for (const file of files) (isPreviewable(file.type) ? previewable : nonPreviewable).push(file);
  return { previewable, nonPreviewable };
}

// Mirrors packages/frontend/src/utility/sensitive-file.ts shouldHideFileByDefault.
export function shouldHideByDefault(file, { nsfw = 'respect', dataSaverMedia = false } = {}, ignoreDataSaver = false) {
  if (nsfw === 'force' || (!ignoreDataSaver && dataSaverMedia)) return true;
  return Boolean(file.isSensitive) && nsfw !== 'ignore';
}

export function layoutClass(count) {
  return count === 1 ? 'n1' : count === 2 ? 'n2' : count === 3 ? 'n3' : count === 4 ? 'n4' : 'nMany';
}
