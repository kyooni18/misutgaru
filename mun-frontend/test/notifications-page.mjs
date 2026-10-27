/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

// Reference behavior from Vue pages/notifications.vue.
test('filter excludes other types, mentions tabs hit notes/mentions, mark all read posts', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const notif = [], mentions = [], marks = [];
    await page.route('**/api/i/notifications', route => { notif.push(route.request().postDataJSON()); return route.fulfill({ json: [] }); });
    await page.route('**/api/notes/mentions', route => { mentions.push(route.request().postDataJSON()); return route.fulfill({ json: [] }); });
    await page.route('**/api/notifications/mark-all-as-read', route => { marks.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); });
    await page.goto(`${base}/test/fixtures/notifications-page.html`);
    await expect.poll(() => notif.length).toBe(1);
    assert.deepEqual(notif[0], { limit: 20, allowPartial: true });
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('menuitem', { name: 'type:follow', exact: true }).click();
    await expect.poll(() => notif.length).toBe(2);
    assert.equal(notif[1].excludeTypes.includes('follow'), false);
    assert.equal(notif[1].excludeTypes.includes('reaction'), true);
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect.poll(() => marks.length).toBe(1);
    await page.getByRole('tab', { name: 'Direct notes' }).click();
    await expect.poll(() => mentions.length).toBe(1);
    assert.deepEqual(mentions[0], { visibility: 'specified', limit: 10, allowPartial: true });
  } finally { await browser.close(); }
});
