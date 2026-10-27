/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { getRenoteMenu } from '../../src/services/renote-menu.mjs';
import { createMisskeyApi } from '../../src/services/misskey-api.mjs';

const services = {
  api: createMisskeyApi({ apiUrl: '/api', getAccount: () => null }),
  toast: t => { (window.fixtureToasts ??= []).push(t); },
  notePosted: () => {},
  quote: q => { window.fixtureQuote = q.renote.id; },
  favoritedChannels: async () => [{ id: 'c1', name: 'One' }],
  config: { rememberNoteVisibility: false, defaultNoteVisibility: 'public', defaultNoteLocalOnly: false },
  labels: { renote: 'Renote', quote: 'Quote', inChannelRenote: 'In channel', inChannelQuote: 'Quote in channel', renoteToChannel: 'Renote to channel', renoteToOtherChannel: 'To other', renoted: 'Renoted', renotedToX: n => 'Renoted to ' + n },
};
export const items = getRenoteMenu({ note: { id: 'n1', visibility: 'home' }, services });
export const onClose = () => { window.fixtureClosed = true; };
