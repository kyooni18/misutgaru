/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const user = { username: 'alice', host: null, name: 'Alice', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };

// Reference behavior from Vue MkNoteSimple / MkNoteHeader / MkCwButton.
async function render(note) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(n => { window.fixtureNote = n; }, note);
  await page.goto(`${base}/test/fixtures/note-simple.html`);
  return { browser, page, errors };
}

test('renders name, local and remote acct, and text', async () => {
  const local = await render({ id: '1', user, text: 'hello', cw: null, createdAt: '2026-01-01T00:00:00Z' });
  try {
    await expect(local.page.locator('.note-simple-name')).toHaveText('Alice');
    await expect(local.page.locator('.note-simple-username')).toHaveText('@alice');
    await expect(local.page.locator('.note-simple-text')).toHaveText('hello');
    await expect(local.page.locator('.note-simple-info time')).toHaveAttribute('datetime', '2026-01-01T00:00:00Z');
    assert.deepEqual(local.errors, []);
  } finally { await local.browser.close(); }
  const remote = await render({ id: '2', user: { ...user, host: 'example.com', isBot: true }, text: 'hi', cw: null, createdAt: '2026-01-01T00:00:00Z' });
  try {
    await expect(remote.page.locator('.note-simple-username')).toHaveText('@alice@example.com');
    await expect(remote.page.locator('.note-simple-bot')).toHaveText('bot');
  } finally { await remote.browser.close(); }
});

test('content warning hides the text until toggled, with a summary label', async () => {
  const { browser, page, errors } = await render({ id: '3', user, text: 'secret', cw: 'spoiler', files: [{}, {}], createdAt: '2026-01-01T00:00:00Z' });
  try {
    await expect(page.locator('.note-simple-cw')).toContainText('spoiler');
    await expect(page.locator('.note-simple-text')).toHaveCount(0);
    await expect(page.locator('.note-simple-cw-label')).toHaveText('6 characters / 2 file(s)');
    await page.getByRole('button', { name: /Show content/ }).click();
    await expect(page.locator('.note-simple-text')).toHaveText('secret');
    await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible();
    await expect(page.locator('.note-simple-cw-label')).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('empty content warning shows only the button; null note renders the deleted placeholder', async () => {
  const empty = await render({ id: '4', user, text: 'x', cw: '', createdAt: '2026-01-01T00:00:00Z' });
  try {
    await expect(empty.page.locator('.note-simple-cw')).not.toContainText('spoiler');
    await expect(empty.page.locator('.note-simple-text')).toHaveCount(0);
  } finally { await empty.browser.close(); }
  const deleted = await render(null);
  try {
    await expect(deleted.page.locator('.note-simple-deleted')).toHaveText('Deleted note');
  } finally { await deleted.browser.close(); }
});
