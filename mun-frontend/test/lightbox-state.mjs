/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getType, toContents, nextIndex, prevIndex, keyAction } from '../src/services/lightbox-state.mjs';

// Reference behavior from Vue MkLightbox.vue and utility/lightbox.ts.
test('types, navigation clamping and key bindings', () => {
  assert.deepEqual(['image/png', 'video/mp4', 'audio/ogg'].map(getType), ['image', 'video', 'audio']);
  assert.throws(() => getType('application/zip'));
  assert.deepEqual(toContents([{ id: 'f', type: 'image/png', url: 'u', name: 'a.png' }])[0], { id: 'f', type: 'image', url: 'u', thumbnailUrl: undefined, filename: 'a.png', file: { id: 'f', type: 'image/png', url: 'u', name: 'a.png' } });
  assert.deepEqual([nextIndex(1, 3), nextIndex(2, 3), prevIndex(1), prevIndex(0)], [2, 2, 0, 0]);
  assert.deepEqual(['Escape', 'ArrowLeft', 'ArrowRight', 'a'].map(keyAction), ['close', 'prev', 'next', null]);
});
