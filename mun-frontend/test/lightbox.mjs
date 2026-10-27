/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

// Reference behavior from Vue MkLightbox.vue.
test('opens at the clicked item, moves with buttons and arrow keys within bounds, closes on Escape or backdrop', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/test/fixtures/lightbox.html`);
    await expect(page.locator('.lightbox-media')).toHaveAttribute('alt', 'second');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.lightbox-media')).toHaveAttribute('alt', 'third');
    await expect(page.getByRole('button', { name: 'Next' })).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.lightbox-media')).toHaveAttribute('alt', 'first');
    assert.equal(await page.evaluate(() => window.fixtureClosed), undefined);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
    await page.evaluate(() => { window.fixtureClosed = false; });
    await page.locator('.lightbox-bg').click({ position: { x: 5, y: 5 } });
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
  } finally { await browser.close(); }
});
