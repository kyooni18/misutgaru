/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const avatarUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const alice = { username: 'alice', host: null, name: 'Alice', avatarUrl };
const bob = { username: 'bob', host: 'example.com', name: null, avatarUrl };
const base_ = { cw: null, files: [], poll: null, createdAt: '2026-01-01T00:00:00Z', reactions: {}, renote: null, renoteId: null };

// Reference behavior from Vue MkNote.
async function render(note) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(n => { window.fixtureNote = n; }, note);
  await page.goto(`${base}/test/fixtures/note-card.html`);
  return { browser, page, errors };
}

test('plain note shows header, text, media grid and reaction counts', async () => {
  const { browser, page, errors } = await render({
    ...base_, id: '1', user: alice, text: 'hello',
    files: [{ id: 'f1', type: 'image/png', url: '/a.png', thumbnailUrl: '/a-t.png', name: 'a.png' }, { id: 'f2', type: 'application/pdf', url: '/b.pdf', name: 'b.pdf' }],
    reactions: { '👍': 3, '❤': 1 }, myReaction: '❤',
  });
  try {
    await expect(page.locator('.note-simple-username')).toHaveText('@alice');
    await expect(page.locator('.note-text')).toHaveText('hello');
    await expect(page.locator('.note-media-item')).toHaveCount(2);
    await expect(page.locator('.note-media-item img')).toHaveAttribute('src', '/a-t.png');
    await expect(page.locator('.note-reaction')).toHaveCount(2);
    await expect(page.locator('.note-reaction.reacted')).toContainText('1');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('note content renders the supported native MFM subset as markup', async () => {
  const { browser, page, errors } = await render({ ...base_, id: 'mfm', user: alice, text: 'hello **bold**\n`code`' });
  try {
    await expect(page.locator('.note-text b')).toHaveText('bold');
    await expect(page.locator('.note-text code')).toHaveText('code');
    await expect(page.locator('.note-text br')).toHaveCount(1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('mentions without a host inherit the remote author host', async () => {
  const { browser, page, errors } = await render({ ...base_, id: 'mention', user: bob, text: '@eve and @lee@other.test' });
  try {
    const mentions = page.locator('.note-text .mfm-mention');
    await expect(mentions).toHaveCount(2);
    await expect(mentions.nth(0)).toHaveAttribute('href', '/@eve@example.com');
    await expect(mentions.nth(0).locator('img')).toHaveAttribute('src', '/avatar/@eve@example.com');
    await expect(mentions.nth(1)).toHaveAttribute('href', '/@lee@other.test');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('renote shows the renoter bar and the renoted note', async () => {
  const { browser, page } = await render({ ...base_, id: '2', user: alice, text: null, renoteId: 'r1', renote: { ...base_, id: 'r1', user: bob, text: 'original' } });
  try {
    await expect(page.locator('.note-renote-text')).toHaveText('Renoted by Alice');
    await expect(page.locator('.note-article .note-simple-name')).toHaveText('bob');
    await expect(page.locator('.note-article .note-simple-username')).toHaveText('@bob@example.com');
    await expect(page.locator('.note-text')).toHaveText('original');
  } finally { await browser.close(); }
});

test('renote of a deleted note shows the placeholder; quote embeds a simple note', async () => {
  const deleted = await render({ ...base_, id: '3', user: alice, text: null, renoteId: 'gone', renote: null });
  try { await expect(deleted.page.locator('.note-simple-deleted')).toHaveText('Deleted note'); } finally { await deleted.browser.close(); }
  const quote = await render({ ...base_, id: '4', user: alice, text: 'look', renoteId: 'q1', renote: { ...base_, id: 'q1', user: bob, text: 'quoted' } });
  try {
    await expect(quote.page.locator('.note-renote')).toHaveCount(0);
    await expect(quote.page.locator('.note-quote .note-simple-text')).toHaveText('quoted');
  } finally { await quote.browser.close(); }
});

test('content warning hides text, media and reactions-free until toggled', async () => {
  const { browser, page } = await render({ ...base_, id: '5', user: alice, text: 'secret', cw: 'cw', files: [{ id: 'f1', type: 'image/png', url: '/a.png', name: 'a' }] });
  try {
    await expect(page.locator('.note-text')).toHaveCount(0);
    await expect(page.locator('.note-media')).toHaveCount(0);
    await expect(page.locator('.note-simple-cw-label')).toHaveText('6 characters / 1 file(s)');
    await page.getByRole('button', { name: /Show content/ }).click();
    await expect(page.locator('.note-text')).toHaveText('secret');
    await expect(page.locator('.note-media-item')).toHaveCount(1);
  } finally { await browser.close(); }
});

test('a poll inside a note renders its choices and total votes', async () => {
  const { browser, page, errors } = await render({ ...base_, id: '6', user: alice, text: 'vote!', poll: { multiple: false, expiresAt: null, choices: [{ text: 'Yes', votes: 2, isVoted: false }, { text: 'No', votes: 1, isVoted: false }] } });
  try {
    await expect(page.locator('.poll-choice')).toHaveCount(2);
    await expect(page.locator('.poll-info')).toContainText('3 total');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
