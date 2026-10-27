/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const user = { id: 'a', username: 'alice', host: null, name: 'Alice', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };
const mk = (id, type, extra = {}) => ({ id, type, createdAt: '2026-01-01T00:00:00Z', user, ...extra });

// Reference behavior from Vue MkStreamingNotificationsTimeline and MkNotification.
test('lists notifications with per-type text, pages by untilId, and answers follow requests', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const requests = [], answers = [];
    await page.route('**/api/i/notifications', route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      return route.fulfill({ json: body.untilId ? [] : [mk('n2', 'follow'), mk('n1', 'receiveFollowRequest')] });
    });
    await page.route('**/api/following/requests/*', route => { answers.push([route.request().url().split('/').pop(), route.request().postDataJSON()]); return route.fulfill({ status: 204 }); });
    await page.goto(`${base}/test/fixtures/notifications.html`);
    await expect(page.locator('.notification')).toHaveCount(2);
    assert.deepEqual(requests[0], { limit: 20, allowPartial: true });
    await expect.poll(() => requests.length).toBe(2);
    assert.deepEqual(requests[1], { limit: 30, untilId: 'n1' });
    await expect(page.locator('.notification-follow .notification-text')).toHaveText('New follower');
    await expect(page.locator('.notification-header-name').first()).toHaveAttribute('href', '/@alice');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => answers.length).toBe(1);
    assert.deepEqual(answers[0], ['accept', { userId: 'a' }]);
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
  } finally { await browser.close(); }
});
