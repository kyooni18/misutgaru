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
    // the end-of-list sentinel is visible on a short page, so older pages load without a click
    await expect(page.locator('.notes-timeline-item')).toHaveCount(3);
    await expect.poll(() => requests.length).toBe(3);
    assert.deepEqual(requests[0], { withRenotes: true, limit: 15, allowPartial: true });
    assert.deepEqual(requests[1], { withRenotes: true, limit: 30, untilId: 'n2' });
    assert.deepEqual(requests[2], { withRenotes: true, limit: 30, untilId: 'n1' });
    await expect(page.locator('.notes-timeline-item .note-text').nth(2)).toHaveText('note n1');
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  } finally { await browser.close(); }
});

test('shows the empty state and the error state with retry', async () => {
  const empty = await open(route => route.fulfill({ json: [] }));
  try { await expect(empty.page.locator('.notes-timeline-empty')).toHaveText('No notes'); } finally { await empty.browser.close(); }
  const failing = await open((route, body, n) => n === 1 ? route.fulfill({ status: 500, json: { error: {} } }) : route.fulfill({ json: body.untilId ? [] : [mk('a')] }));
  try {
    await expect(failing.page.getByRole('alert')).toContainText('Error');
    await failing.page.getByRole('button', { name: 'Retry' }).click();
    await expect(failing.page.locator('.notes-timeline-item')).toHaveCount(1);
  } finally { await failing.browser.close(); }
});

test('inserts a date separator between notes from different days only', async () => {
  const at = (id, createdAt) => ({ ...mk(id), createdAt });
  const { browser, page } = await open((route, body) => route.fulfill({ json: body.untilId ? [] : [at('c', '2026-03-05T12:00:00'), at('b', '2026-03-05T08:00:00'), at('a', '2026-03-04T23:00:00')] }));
  try {
    await expect(page.locator('.notes-timeline-item')).toHaveCount(3);
    await expect(page.locator('.notes-timeline-date')).toHaveCount(1);
    await expect(page.locator('.notes-timeline-date')).toContainText('3/5');
    await expect(page.locator('.notes-timeline-date')).toContainText('3/4');
    // the separator sits above the first note of the older day
    await expect(page.locator('.notes-timeline-row').nth(2).locator('.notes-timeline-date')).toHaveCount(1);
  } finally { await browser.close(); }
});

test('scrolling the end of the list into view fetches older notes automatically', async () => {
  const filler = Array.from({ length: 15 }, (_, i) => mk(`n${30 - i}`));
  const { browser, page, requests } = await open((route, body) => route.fulfill({ json: body.untilId === 'old' ? [] : body.untilId ? [mk('old')] : filler }));
  try {
    await expect(page.locator('.notes-timeline-item')).toHaveCount(15);
    await page.locator('.notes-timeline-sentinel').scrollIntoViewIfNeeded();
    await expect(page.locator('.notes-timeline-item')).toHaveCount(16);
    assert.equal(requests[1].untilId, 'n16');
    assert.equal(requests[1].limit, 30);
  } finally { await browser.close(); }
});
