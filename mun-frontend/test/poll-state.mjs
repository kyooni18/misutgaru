/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollSummary, remainingText } from '../src/services/poll-state.mjs';

const choices = [{ text: 'a', votes: 3, isVoted: false }, { text: 'b', votes: 1, isVoted: true }];

test('summary totals votes and detects voted and closed polls like MkPoll', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.deepEqual(pollSummary({ choices, multiple: false, expiresAt: null }, now), { remaining: -1, total: 4, closed: false, voted: true });
  assert.equal(pollSummary({ choices, multiple: true, expiresAt: null }, now).voted, false);
  assert.equal(pollSummary({ choices, multiple: true, expiresAt: '2025-12-31T00:00:00Z' }, now).closed, true);
  assert.equal(pollSummary({ choices, multiple: true, expiresAt: '2026-01-01T00:01:30Z' }, now).remaining, 90);
});

test('remaining text picks the largest unit and passes split components', () => {
  const tsx = Object.fromEntries(['remainingDays', 'remainingHours', 'remainingMinutes', 'remainingSeconds'].map(k => [k, p => `${k}:${p.d}/${p.h}/${p.m}/${p.s}`]));
  assert.equal(remainingText(tsx, 90061), 'remainingDays:1/1/1/1');
  assert.equal(remainingText(tsx, 3700), 'remainingHours:0/1/1/40');
  assert.equal(remainingText(tsx, 90), 'remainingMinutes:0/0/1/30');
  assert.equal(remainingText(tsx, 5), 'remainingSeconds:0/0/0/5');
});
