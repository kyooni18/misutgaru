/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

test('picker lists the palette, chooses an emoji, and closes on backdrop click or Escape without choosing', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/test/fixtures/reaction-picker.html`);
    await expect(page.locator('.reaction-picker-emoji')).toHaveText(['👍', '❤️', '😆']);
    await page.locator('.reaction-picker-emoji').nth(1).click();
    assert.equal(await page.evaluate(() => window.fixtureChosen), '❤️');
    assert.equal(await page.evaluate(() => window.fixtureClosed), undefined);
    await page.locator('.reaction-picker-backdrop').click({ position: { x: 5, y: 5 } });
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
    await page.evaluate(() => { window.fixtureClosed = false; });
    await page.locator('.reaction-picker').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
  } finally { await browser.close(); }
});
