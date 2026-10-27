/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const user = { id: 'u', username: 'alice', host: null, name: 'Alice', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };
const mk = (id, extra = {}) => ({ id, user, text: `note ${id}`, cw: null, files: [], poll: null, reactions: {}, renote: null, renoteId: null, replyId: null, repliesCount: 0, createdAt: '2026-01-01T00:00:00Z', ...extra });

// Reference behavior from Vue pages/note.vue, MkNoteDetailed.vue and MkNoteThreadTree.vue.
test('shows the note with its conversation above (oldest first) and nested replies below', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const calls = [];
    const json = (route, body) => { calls.push([new URL(route.request().url()).pathname.split('/api/')[1], route.request().postDataJSON()]); return route.fulfill({ json: body }); };
    await page.route('**/api/notes/show', r => json(r, mk('n1', { replyId: 'p2', repliesCount: 1 })));
    await page.route('**/api/notes/conversation', r => json(r, [mk('p2', { replyId: 'p1' }), mk('p1')]));
    await page.route('**/api/notes/children', r => { const id = r.request().postDataJSON().noteId; return json(r, id === 'n1' ? [mk('c1', { repliesCount: 1 })] : id === 'c1' ? [mk('c2')] : []); });
    await page.goto(`${base}/test/fixtures/note-page.html`);
    await expect(page.locator('.note-page-ancestor .note-text')).toHaveText(['note p1', 'note p2']);
    await expect(page.locator('.note-page-focus .note-text')).toHaveText('note n1');
    await expect(page.locator('.thread-tree-nested .note-text')).toHaveText('note c2');
    assert.deepEqual(calls.map(c => c[0] + ' ' + JSON.stringify(c[1])).sort(), [
      'notes/children {"noteId":"c1","limit":30}', 'notes/children {"noteId":"n1","limit":30}',
      'notes/conversation {"noteId":"p2"}', 'notes/show {"noteId":"n1"}',
    ]);
  } finally { await browser.close(); }
});

test('a failed load shows the error, reports sign-in-required ids, and retries', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let n = 0;
    await page.route('**/api/notes/show', r => (++n === 1 ? r.fulfill({ status: 403, json: { error: { id: 'fbcc002d-37d9-4944-a6b0-d9e29f2d33ab', message: 'x' } } }) : r.fulfill({ json: mk('n1') })));
    await page.route('**/api/notes/children', r => r.fulfill({ json: [] }));
    await page.goto(`${base}/test/fixtures/note-page.html`);
    await expect(page.getByRole('alert')).toBeVisible();
    assert.equal(await page.evaluate(() => window.fixtureLoginError), 'fbcc002d-37d9-4944-a6b0-d9e29f2d33ab');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.note-page-focus .note-text')).toHaveText('note n1');
  } finally { await browser.close(); }
});
