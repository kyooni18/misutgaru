// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

test('visitor metadata, retry, and navigation', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let count = 0;
    await page.route('**/api/meta', async route => {
      const request = route.request();
      assert.equal(request.method(), 'POST');
      assert.deepEqual(request.postDataJSON(), { detail: true });
      count++;
      if (count === 1) return route.fulfill({ status: 500, json: { error: {} } });
      return route.fulfill({ json: { name: 'Test server', description: 'A friendly server' } });
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5174/');
    await expect(page.getByRole('status')).toHaveText('Could not load server information.');
    await page.getByRole('button', { name: 'Refresh server information' }).click();
    await expect(page.getByRole('heading', { name: 'Test server' })).toBeVisible();
    await expect(page.getByText('A friendly server')).toBeVisible();
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About Test server' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Test server' })).toBeVisible();
    assert.equal(count, 4);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
