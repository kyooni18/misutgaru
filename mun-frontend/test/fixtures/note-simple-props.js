/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from '../../src/services/misskey-api.mjs';

// The page under test sets window.fixtureNote before this module loads.
export const note = window.fixtureNote ?? null;
export const labels = {
  deletedNote: 'Deleted note', cwShow: 'Show content', cwHide: 'Hide', poll: 'Poll',
  quote: 'Quote', renotedBy: name => `Renoted by ${name}`, cwChars: n => `${n} characters`, cwFiles: n => `${n} file(s)`,
};
export const formatTime = () => '1m ago';
labels.error = 'Error'; labels.retry = 'Retry'; labels.noNotes = 'No notes'; labels.more = 'Load more';
export const api = createMisskeyApi({ apiUrl: '/api', getAccount: () => null });
export const services = {
  now: () => Date.parse('2026-01-01T00:00:00Z'),
  login: async () => true,
  confirmVote: async () => true,
  media: () => ({ nsfw: 'respect', dataSaverMedia: false }),
  confirmReveal: async () => true,
  signedIn: () => window.fixtureSignedIn !== false,
  confirmOnReact: false,
  showReactionsCount: false,
  account: () => window.fixtureAccount ?? null,
  reply: note => { (window.fixtureActions ??= []).push(['reply', note.id]); },
  renote: note => { (window.fixtureActions ??= []).push(['renote', note.id]); },
  reactPicker: note => { (window.fixtureActions ??= []).push(['react', note.id]); },
  confirm: async () => true,
  reportError: error => { window.fixtureErrors = [...(window.fixtureErrors ?? []), String(error)]; },
  open: () => {},
  api,
};
labels.pollTexts = { votesCount: p => `${p.n} votes`, totalVotes: p => `${p.n} total`, remainingMinutes: p => `${p.m}m left`, remainingSeconds: p => `${p.s}s left`, remainingHours: p => `${p.h}h left`, remainingDays: p => `${p.d}d left` };
labels.pollVote = 'Vote'; labels.pollShowResult = 'Show result'; labels.pollVoted = 'Voted'; labels.pollClosed = 'Closed';
labels.sensitive = 'Sensitive'; labels.clickToShow = 'Click to show'; labels.hide = 'Hide'; labels.mediaKind = type => type.split('/')[0];
labels.reply = 'Reply'; labels.renote = 'Renote'; labels.reaction = 'React';
