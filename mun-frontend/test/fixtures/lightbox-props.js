/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { toContents } from '../../src/services/lightbox-state.mjs';

const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
export const contents = toContents([
  { id: 'a', type: 'image/png', url: px, name: 'first' },
  { id: 'b', type: 'image/png', url: px + '#2', name: 'second' },
  { id: 'c', type: 'image/png', url: px + '#3', name: 'third' },
]);
export const defaultIndex = 1;
export const lightboxLabels = { close: 'Close', prev: 'Previous', next: 'Next' };
export const onClose = () => { window.fixtureClosed = true; };
