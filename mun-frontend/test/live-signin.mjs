/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Explicit opt-in: use only a disposable test account on an authorized instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';

const { FRONTEND_URL, MUN_TEST_USERNAME, MUN_TEST_PASSWORD, MUN_TEST_LOCALE_VERSION, MUN_TEST_BROWSER } = process.env;
test('native visitor signs in against a real backend and restores the account', { skip: !FRONTEND_URL || !MUN_TEST_USERNAME || !MUN_TEST_PASSWORD }, async () => {
  const browser = await (MUN_TEST_BROWSER === 'webkit' ? webkit : chromium).launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.accept(); });
    // Optional when testing a backend image whose packaged asset version differs.
    if (MUN_TEST_LOCALE_VERSION) await page.route('**/assets/locales/*.json', route => {
      const url = new URL(route.request().url());
      url.pathname = url.pathname.replace(/(\/[^/.]+\.)[^/]+(\.json)$/, `$1${MUN_TEST_LOCALE_VERSION}$2`);
      return route.continue({ url: url.href });
    });
    await page.goto(FRONTEND_URL);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('input[autocomplete="username webauthn"]').fill(MUN_TEST_USERNAME);
    await page.getByTestId('signin-page-input-continue').click();
    await page.locator('input[type=password]').fill(MUN_TEST_PASSWORD);
    await page.getByTestId('signin-page-password-continue').click();
    await expect.poll(() => page.evaluate(() => {
      const account = JSON.parse(localStorage.getItem('account') ?? 'null');
      return Boolean(account?.id && account?.token);
    }), { timeout: 30000 }).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(async username => {
      const account = JSON.parse(localStorage.getItem('account') ?? 'null');
      if (!account?.token) return false;
      const response = await fetch('/api/i', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ i: account.token }) });
      if (!response.ok) return false;
      const me = await response.json();
      return me.id === account.id && me.username === username;
    }, MUN_TEST_USERNAME)).toBe(true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
