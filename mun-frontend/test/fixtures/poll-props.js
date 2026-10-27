/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from '../../src/services/misskey-api.mjs';

const poll = window.fixturePoll;
export const { multiple, expiresAt, choices } = poll;
export const readOnly = poll.readOnly ?? false;
export const pollServices = {
  now: () => Date.parse('2026-01-01T00:00:00Z'),
  login: async () => window.fixtureLoggedIn !== false,
  confirmVote: async text => { window.fixtureConfirmed = text; return window.fixtureConfirm !== false; },
  api: createMisskeyApi({ apiUrl: '/api', getAccount: () => null }),
};
export const pollLabels = {
  pollTexts: { votesCount: p => `${p.n} votes`, totalVotes: p => `${p.n} total`, remainingMinutes: p => `${p.m}m left`, remainingSeconds: p => `${p.s}s left`, remainingHours: p => `${p.h}h left`, remainingDays: p => `${p.d}d left` },
  pollVote: 'Vote', pollShowResult: 'Show result', pollVoted: 'Voted', pollClosed: 'Closed',
};
