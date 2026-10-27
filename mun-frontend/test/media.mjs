/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { isPreviewable, shouldHideByDefault, splitMedia, layoutClass } from '../src/services/media-rules.mjs';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const img = (id, extra = {}) => ({ id, type: 'image/png', url: px, thumbnailUrl: px, name: `${id}.png`, isSensitive: false, ...extra });

// Reference rules from Vue lightbox.ts / sensitive-file.ts / MkMediaList.vue.
test('previewable, hide-by-default and layout rules match Vue', () => {
  assert.equal(isPreviewable('image/png'), true);
  assert.equal(isPreviewable('image/svg+xml'), true);
  assert.equal(isPreviewable('application/pdf'), false);
  assert.equal(isPreviewable('image/png; charset=x'), true);
  assert.equal(shouldHideByDefault({ isSensitive: true }), true);
  assert.equal(shouldHideByDefault({ isSensitive: true }, { nsfw: 'ignore' }), false);
  assert.equal(shouldHideByDefault({ isSensitive: false }, { nsfw: 'force' }), true);
  assert.equal(shouldHideByDefault({ isSensitive: false }, { dataSaverMedia: true }), true);
  assert.equal(shouldHideByDefault({ isSensitive: false }, { dataSaverMedia: true }, true), false);
  assert.deepEqual([1, 2, 3, 4, 5].map(layoutClass), ['n1', 'n2', 'n3', 'n4', 'nMany']);
  assert.deepEqual(splitMedia([img('a'), { id: 'b', type: 'application/zip' }]).nonPreviewable.map(f => f.id), ['b']);
});

async function render(files, { prefs, allowReveal, forceShow } = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(([f, p, a, s]) => { window.fixtureFiles = f; window.fixtureMediaPrefs = p; window.fixtureAllowReveal = a; window.fixtureForceShow = s; }, [files, prefs, allowReveal, forceShow]);
  await page.goto(`${base}/test/fixtures/media.html`);
  return { browser, page };
}

test('lays out previewable files by count and lists other files as banners', async () => {
  const { browser, page } = await render([img('a'), img('b'), img('c'), { id: 'z', type: 'application/zip', url: '/z.zip', name: 'z.zip' }]);
  try {
    await expect(page.locator('.media-grid.n3')).toHaveCount(1);
    await expect(page.locator('.media-item img')).toHaveCount(3);
    await expect(page.locator('.media-banner')).toHaveText(/z\.zip/);
    await page.locator('.media-item').first().click();
    assert.deepEqual(await page.evaluate(() => window.fixtureOpened), ['a']);
  } finally { await browser.close(); }
});

test('sensitive images are hidden until clicked; declined confirmation keeps them hidden; forceShow reveals', async () => {
  const { browser, page } = await render([img('s', { isSensitive: true })]);
  try {
    await expect(page.locator('.media-item.hidden')).toHaveCount(1);
    await expect(page.locator('.media-item img')).toHaveCount(0);
    await expect(page.locator('.media-hidden-text')).toContainText('Sensitive');
    await page.locator('.media-item').click();
    await expect(page.locator('.media-item img')).toHaveCount(1);
    assert.equal(await page.evaluate(() => window.fixtureConfirmCount), 1);
    assert.deepEqual(await page.evaluate(() => window.fixtureOpened), []);
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(page.locator('.media-item.hidden')).toHaveCount(1);
  } finally { await browser.close(); }
  const declined = await render([img('s', { isSensitive: true })], { allowReveal: false });
  try {
    await declined.page.locator('.media-item').click();
    await declined.page.waitForTimeout(200);
    await expect(declined.page.locator('.media-item.hidden')).toHaveCount(1);
  } finally { await declined.browser.close(); }
  const forced = await render([img('s', { isSensitive: true })], { forceShow: true });
  try { await expect(forced.page.locator('.media-item img')).toHaveCount(1); } finally { await forced.browser.close(); }
});

test('nsfw=ignore shows sensitive media, GIF and ALT indicators appear', async () => {
  const { browser, page } = await render([img('g', { type: 'image/gif', comment: 'a cat', isSensitive: true })], { prefs: { nsfw: 'ignore', dataSaverMedia: false } });
  try {
    await expect(page.locator('.media-item img')).toHaveAttribute('alt', 'a cat');
    await expect(page.locator('.media-indicator')).toHaveText(['GIF', 'ALT', '!']);
  } finally { await browser.close(); }
});
