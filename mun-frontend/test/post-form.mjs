/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

// Reference behavior from Vue MkPostForm.vue post().
async function open(target = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const bodies = [];
  await page.route('**/api/notes/create', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { createdNote: { id: 'new' } } }); });
  await page.addInitScript(t => { window.fixtureTarget = t; }, target);
  await page.goto(`${base}/test/fixtures/post-form.html`);
  return { browser, page, bodies };
}

test('submit is disabled until there is text, then POSTs notes/create and clears the form', async () => {
  const { browser, page, bodies } = await open();
  try {
    const submit = page.locator('.post-form-submit');
    await expect(submit).toBeDisabled();
    await page.locator('.post-form-text').fill('hello');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => bodies.length).toBe(1);
    assert.deepEqual(bodies[0], { text: 'hello', poll: null, cw: null, localOnly: false, visibility: 'public', reactionAcceptance: null });
    await expect(page.locator('.post-form-text')).toHaveValue('');
    assert.equal(await page.evaluate(() => window.fixturePosted.id), 'new');
  } finally { await browser.close(); }
});

test('content warning, visibility and reply target go into the request body', async () => {
  const { browser, page, bodies } = await open({ reply: { id: 'r1' } });
  try {
    await page.locator('.post-form-cw-toggle').click();
    await page.locator('.post-form-cw').fill('spoiler');
    await page.locator('.post-form-text').fill('body');
    await page.locator('.post-form-visibility').selectOption('followers');
    await page.locator('.post-form-submit').click();
    await expect.poll(() => bodies.length).toBe(1);
    assert.deepEqual(bodies[0], { text: 'body', replyId: 'r1', poll: null, cw: 'spoiler', localOnly: false, visibility: 'followers', reactionAcceptance: null });
  } finally { await browser.close(); }
});
