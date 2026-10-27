/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { canRenote, reactionCount, reactIcon, showReactionCount } from '../src/services/note-footer.mjs';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const alice = { username: 'alice', host: null, name: 'Alice', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' };
const note = (extra = {}) => ({ id: 'n1', userId: 'u1', user: alice, text: 'hi', cw: null, files: [], poll: null, reactions: {}, renote: null, renoteId: null, visibility: 'public', repliesCount: 0, renoteCount: 0, createdAt: '2026-01-01T00:00:00Z', ...extra });

// Reference rules from Vue use-note.ts canRenote and the MkNote footer.
test('footer rules match Vue', () => {
  assert.equal(canRenote({ visibility: 'public' }, null), true);
  assert.equal(canRenote({ visibility: 'home' }, null), true);
  assert.equal(canRenote({ visibility: 'followers', userId: 'u1' }, { id: 'u1' }), true);
  assert.equal(canRenote({ visibility: 'followers', userId: 'u1' }, { id: 'u2' }), false);
  assert.equal(canRenote({ visibility: 'specified' }, { id: 'u1' }), false);
  assert.equal(reactionCount({ a: 2, b: 3 }), 5);
  assert.equal(reactIcon({}, null), 'plus');
  assert.equal(reactIcon({}, 'x'), 'minus');
  assert.equal(reactIcon({ reactionAcceptance: 'likeOnly' }, null), 'heart');
  assert.equal(reactIcon({ reactionAcceptance: 'likeOnly' }, 'x'), 'heart-filled');
  assert.equal(showReactionCount({}, false, 3), false);
  assert.equal(showReactionCount({}, true, 3), true);
  assert.equal(showReactionCount({ reactionAcceptance: 'likeOnly' }, false, 3), true);
  assert.equal(showReactionCount({ reactionAcceptance: 'likeOnly' }, true, 0), false);
});

async function render(n) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(x => { window.fixtureNote = x; }, n);
  await page.goto(`${base}/test/fixtures/note-card.html`);
  return { browser, page };
}

test('footer shows reply and renote counts and delegates clicks to services', async () => {
  const { browser, page } = await render(note({ repliesCount: 3, renoteCount: 12 }));
  try {
    await expect(page.locator('.note-reply .note-footer-count')).toHaveText('3');
    await expect(page.locator('.note-renote-button .note-footer-count')).toHaveText('12');
    await page.locator('.note-reply').click();
    await page.locator('.note-renote-button').click();
    await page.locator('.note-react').click();
    assert.deepEqual(await page.evaluate(() => window.fixtureActions), [['reply', 'n1'], ['renote', 'n1'], ['react', 'n1']]);
    await expect(page.locator('.note-react i')).toHaveClass(/ti-plus/);
  } finally { await browser.close(); }
});

test('private notes show a disabled renote button; reply count hidden at zero', async () => {
  const { browser, page } = await render(note({ visibility: 'specified' }));
  try {
    await expect(page.locator('.note-renote-disabled')).toBeDisabled();
    await expect(page.locator('.note-renote-button')).toHaveCount(0);
    await expect(page.locator('.note-reply .note-footer-count')).toHaveCount(0);
  } finally { await browser.close(); }
});
