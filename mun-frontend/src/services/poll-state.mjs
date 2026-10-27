/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Pure poll rules mirrored from packages/frontend/src/components/MkPoll.vue.
export function remainingSeconds(expiresAt, now) {
  if (expiresAt == null) return -1;
  return Math.floor(Math.max(new Date(expiresAt).getTime() - now, 0) / 1000);
}

export function pollSummary({ choices, multiple, expiresAt }, now) {
  const remaining = remainingSeconds(expiresAt, now);
  const total = choices.reduce((sum, c) => sum + c.votes, 0);
  const closed = expiresAt != null && remaining <= 0;
  const voted = !multiple && choices.some(c => c.isVoted);
  return { remaining, total, closed, voted };
}

export function remainingText(tsx, remaining) {
  const unit = remaining >= 86400 ? 'remainingDays' : remaining >= 3600 ? 'remainingHours' : remaining >= 60 ? 'remainingMinutes' : 'remainingSeconds';
  return tsx[unit]({ s: Math.floor(remaining % 60), m: Math.floor(remaining / 60) % 60, h: Math.floor(remaining / 3600) % 24, d: Math.floor(remaining / 86400) });
}
