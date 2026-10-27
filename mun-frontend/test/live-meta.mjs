// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
// Explicit opt-in: this only calls the read-only /api/meta endpoint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

test('renders metadata from a running Misutgaru backend', { skip: !process.env.FRONTEND_URL }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/meta'));
    await page.goto(process.env.FRONTEND_URL);
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    assert.equal(response.request().method(), 'POST');
    assert.deepEqual(response.request().postDataJSON(), { detail: true });
    const meta = await response.json();
    assert.equal(typeof meta.version, 'string');
    await expect(page.getByRole('heading', { name: meta.name || 'Misutgaru', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
