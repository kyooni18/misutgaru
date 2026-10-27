/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const av = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const alice = { id: 'u1', username: 'alice', host: null, name: 'Alice', avatarUrl: av, bannerUrl: null, description: 'hello\nworld', notesCount: 12, followingCount: 3, followersCount: 4, isFollowed: true, isLocked: true, isBot: false, publicReactions: false };

// Reference behavior from Vue pages/user/index.vue and home.vue.
async function open(me = null, status = 200) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const calls = [];
  await page.addInitScript(m => { window.fixtureMe = m; }, me);
  await page.route('**/api/users/show', r => { calls.push(r.request().postDataJSON()); return status === 200 ? r.fulfill({ json: alice }) : r.fulfill({ status, json: { error: { id: 'x', message: 'x' } } }); });
  await page.route('**/api/users/notes', r => r.fulfill({ json: [] }));
  await page.goto(`${base}/test/fixtures/user-page.html`);
  return { browser, page, calls };
}

test('loads users/show and renders the profile header, tabs and counts', async () => {
  const { browser, page, calls } = await open({ id: 'me', username: 'me' });
  try {
    await expect(page.locator('.user-profile-name')).toHaveText('Alice');
    assert.deepEqual(calls[0], { username: 'alice', host: null });
    await expect(page.locator('.user-profile-acct')).toContainText('@alice@m.example');
    await expect(page.locator('.user-profile-description')).toHaveText('hello\nworld');
    await expect(page.locator('.user-profile-followed')).toHaveText('Follows you');
    await expect(page.locator('.user-profile-notes-count')).toHaveText('12');
    await expect(page.locator('.follow-button')).toHaveCount(1);
    await expect(page.getByRole('tab')).toHaveText(['tab:home', 'tab:notes', 'tab:files', 'tab:activity', 'tab:achievements', 'tab:clips', 'tab:lists', 'tab:pages', 'tab:flashs', 'tab:gallery', 'tab:raw']);
    await page.getByRole('tab', { name: 'tab:notes' }).click();
    await expect(page.locator('.user-profile')).toHaveCount(0);
  } finally { await browser.close(); }
});

test('visitors see no follow-state hint; own profile has no follow button; failures offer retry', async () => {
  const visitor = await open(null);
  try {
    await expect(page_name(visitor.page)).toHaveText('Alice');
    await expect(visitor.page.locator('.user-profile-followed')).toHaveCount(0);
  } finally { await visitor.browser.close(); }
  const self = await open({ id: 'u1', username: 'alice' });
  try {
    await expect(page_name(self.page)).toHaveText('Alice');
    await expect(self.page.locator('.follow-button')).toHaveCount(0);
  } finally { await self.browser.close(); }
  const failed = await open(null, 404);
  try { await expect(failed.page.getByRole('alert')).toBeVisible(); } finally { await failed.browser.close(); }
});
const page_name = p => p.locator('.user-profile-name');
