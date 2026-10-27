/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

async function open() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const bodies = [];
  await page.route('**/api/notes/create', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { createdNote: { id: 'new' } } }); });
  await page.goto(`${base}/test/fixtures/renote-menu.html`);
  return { browser, page, bodies };
}

// Reference behavior from Vue getRenoteMenu.
test('Renote posts a pure renote with the narrower visibility, toasts, and closes the menu', async () => {
  const { browser, page, bodies } = await open();
  try {
    await expect(page.locator('.renote-menu-item')).toHaveText(['Renote', 'Quote', 'Renote to channel']);
    await page.getByRole('menuitem', { name: 'Renote', exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    assert.deepEqual(bodies[0], { localOnly: false, visibility: 'home', renoteId: 'n1' });
    await expect.poll(() => page.evaluate(() => window.fixtureToasts)).toEqual(['Renoted']);
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
  } finally { await browser.close(); }
});

test('channel entry expands favorites and renotes into the chosen channel', async () => {
  const { browser, page, bodies } = await open();
  try {
    await page.getByRole('menuitem', { name: 'Renote to channel' }).click();
    await page.getByRole('menuitem', { name: 'One' }).click();
    await expect.poll(() => bodies.length).toBe(1);
    assert.deepEqual(bodies[0], { renoteId: 'n1', channelId: 'c1' });
  } finally { await browser.close(); }
});
