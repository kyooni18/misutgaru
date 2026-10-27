/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRenoteMenu, smallerVisibility } from '../src/services/renote-menu.mjs';

function setup(config = {}) {
  const calls = [], toasts = [];
  return { calls, toasts, services: {
    api: { post: async (e, b) => { calls.push([e, b]); return { createdNote: { id: 'new' } }; } },
    toast: t => toasts.push(t), notePosted: () => {}, quote: () => {},
    favoritedChannels: async () => [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }],
    config: { rememberNoteVisibility: false, defaultNoteVisibility: 'public', defaultNoteLocalOnly: false, ...config },
    labels: { renote: 'Renote', quote: 'Quote', inChannelRenote: 'In channel', inChannelQuote: 'Quote in channel', renoteToChannel: 'To channel', renoteToOtherChannel: 'To other', renoted: 'Renoted', renotedToX: n => 'Renoted to ' + n },
  } };
}
const text = items => items.map(i => i.text ?? i.type);

// Reference behavior from Vue get-note-menu.ts getRenoteMenu.
test('menu layout follows the channel rules', () => {
  assert.deepEqual(text(getRenoteMenu({ note: { id: 'n', visibility: 'public' }, services: setup().services })), ['Renote', 'Quote', 'divider', 'To channel']);
  const note = { id: 'n', visibility: 'public', channelId: 'c1', channel: { allowRenoteToExternal: false } };
  assert.deepEqual(text(getRenoteMenu({ note, services: setup().services })), ['In channel', 'Quote in channel']);
  const open = { ...note, channel: { allowRenoteToExternal: true } };
  assert.deepEqual(text(getRenoteMenu({ note: open, services: setup().services })), ['Renote', 'Quote', 'divider', 'In channel', 'Quote in channel', 'divider', 'To other']);
});

test('renote narrows visibility; channel submenu skips the current channel', async () => {
  const a = setup({ defaultNoteVisibility: 'followers', defaultNoteLocalOnly: true });
  await getRenoteMenu({ note: { id: 'n', visibility: 'public' }, services: a.services })[0].action();
  assert.deepEqual(a.calls, [['notes/create', { localOnly: true, visibility: 'followers', renoteId: 'n' }]]);
  assert.equal(smallerVisibility('home', 'specified'), 'specified');
  const b = setup();
  const note = { id: 'n', visibility: 'public', channelId: 'c1', channel: { allowRenoteToExternal: true } };
  const children = await getRenoteMenu({ note, services: b.services }).at(-1).children();
  assert.deepEqual(text(children), ['Two']);
  await children[0].action();
  assert.deepEqual(b.calls, [['notes/create', { renoteId: 'n', channelId: 'c2' }]]);
  assert.deepEqual(b.toasts, ['Renoted to Two']);
});
