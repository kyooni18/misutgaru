/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const user = { username: 'alice', host: null, name: 'Alice', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };
const mk = id => ({ id, user, text: `note ${id}`, cw: null, files: [], poll: null, reactions: {}, renote: null, renoteId: null, createdAt: '2026-01-01T00:00:00Z' });

// Reference behavior from Vue pages/user/index.timeline.vue.
test('user timeline starts on All with limit 10 and switches tabs to the matching endpoint', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const requests = [];
    await page.route(/\/api\/users\/(notes|featured-notes)$/, route => {
      requests.push([new URL(route.request().url()).pathname.split('/api/')[1], route.request().postDataJSON()]);
      return route.fulfill({ json: [mk('n1')] });
    });
    await page.goto(`${base}/test/fixtures/user-timeline.html`);
    await expect(page.locator('.notes-timeline-item').first()).toBeVisible();
    assert.deepEqual(requests[0], ['users/notes', { userId: 'u1', withRenotes: true, withReplies: true, withChannelNotes: true, withFiles: false, limit: 10, allowPartial: true }]);
    await page.getByRole('tab', { name: 'Featured' }).click();
    await expect.poll(() => requests.some(r => r[0] === 'users/featured-notes')).toBe(true);
    assert.deepEqual(requests.find(r => r[0] === 'users/featured-notes')[1], { userId: 'u1', limit: 10, allowPartial: true });
    await page.getByRole('tab', { name: 'With files' }).click();
    await expect.poll(() => requests.some(r => r[1].withFiles === true)).toBe(true);
  } finally { await browser.close(); }
});
