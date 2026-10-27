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

// Reference: Vue Paginator sends limit 15 + allowPartial first, then limit 30 + untilId of the oldest item.
async function open(handler) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests = [];
  await page.route('**/api/notes/local-timeline', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await handler(route, body, requests.length);
  });
  await page.goto(`${base}/test/fixtures/timeline.html`);
  return { browser, page, requests };
}

test('loads the first page, then older notes by untilId until exhausted', async () => {
  const { browser, page, requests } = await open((route, body) => route.fulfill({ json: body.untilId === 'n2' ? [mk('n1')] : body.untilId === 'n1' ? [] : [mk('n3'), mk('n2')] }));
  try {
    await expect(page.locator('.notes-timeline-item')).toHaveCount(2);
    assert.deepEqual(requests[0], { withRenotes: true, limit: 15, allowPartial: true });
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.locator('.notes-timeline-item')).toHaveCount(3);
    assert.deepEqual(requests[1], { withRenotes: true, limit: 30, untilId: 'n2' });
    await expect(page.locator('.notes-timeline-item .note-text').nth(2)).toHaveText('note n1');
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    await expect(page.locator('.notes-timeline-item')).toHaveCount(3);
  } finally { await browser.close(); }
});

test('shows the empty state and the error state with retry', async () => {
  const empty = await open(route => route.fulfill({ json: [] }));
  try { await expect(empty.page.locator('.notes-timeline-empty')).toHaveText('No notes'); } finally { await empty.browser.close(); }
  const failing = await open((route, _b, n) => n === 1 ? route.fulfill({ status: 500, json: { error: {} } }) : route.fulfill({ json: [mk('a')] }));
  try {
    await expect(failing.page.getByRole('alert')).toContainText('Error');
    await failing.page.getByRole('button', { name: 'Retry' }).click();
    await expect(failing.page.locator('.notes-timeline-item')).toHaveCount(1);
  } finally { await failing.browser.close(); }
});
