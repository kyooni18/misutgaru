// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

test('visitor metadata, retry, and navigation', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/stats', route => route.abort());
    await page.route('**/assets/locales/**', route => route.fulfill({ status: 404 }));
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
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
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

// A slow earlier response must not overwrite a newer refresh.
test('refresh ignores a stale metadata response', async () => {
  const browser = await chromium.launch({ headless: true });
  let release, finishOld;
  const oldFinished = new Promise(resolve => { finishOld = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  try {
    const page = await browser.newPage();
    await page.route('**/api/stats', route => route.abort());
    await page.route('**/assets/locales/**', route => route.fulfill({ status: 404 }));
    let count = 0;
    await page.route('**/api/meta', async route => {
      count++;
      if (count === 1) {
        await gate;
        try { await route.fulfill({ json: { name: 'Stale server' } }); } catch { /* The browser may abort the old request. */ } finally { finishOld(); }
      } else {
        await route.fulfill({ json: { name: 'Fresh server' } });
      }
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
    await expect(page.getByRole('status')).toHaveText('Loading server information…');
    await page.getByRole('button', { name: 'Refresh server information' }).click();
    await expect(page.getByRole('heading', { name: 'Fresh server' })).toBeVisible();
    release();
    await oldFinished;
    await expect(page.getByRole('heading', { name: 'Fresh server' })).toBeVisible();
    assert.equal(count, 2);
  } finally { release(); await browser.close(); }
});

// Existing Vue account caches are read once at boot and sent in the API body.
test('metadata request uses the cached account token', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/stats', route => route.abort());
    await page.route('**/assets/locales/**', route => route.fulfill({ status: 404 }));
    await page.addInitScript(() => localStorage.setItem('account', JSON.stringify({ id: 'fixture-user', token: 'fixture-token' })));
    let recordMeta, recordAccount;
    const requestSeen = new Promise(resolve => { recordMeta = resolve; });
    const accountSeen = new Promise(resolve => { recordAccount = resolve; });
    await page.route('**/api/meta', async route => {
      recordMeta(route.request().postDataJSON());
      await route.fulfill({ json: { name: 'Test server' } });
    });
    await page.route('**/api/i', async route => {
      recordAccount(route.request().postDataJSON());
      await route.fulfill({ json: { id: 'fixture-user', name: 'Refreshed user' } });
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
    assert.deepEqual(await requestSeen, { detail: true, i: 'fixture-token' });
    assert.deepEqual(await accountSeen, { i: 'fixture-token' });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('account')).name)).toBe('Refreshed user');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('account')).token), 'fixture-token');
    await expect(page.getByRole('heading', { name: 'Test server' })).toBeVisible();
  } finally { await browser.close(); }
});

test('native locale loader uses the shared translation implementation', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/stats', route => route.abort());
    await page.route('**/assets/locales/**', route => route.fulfill({ status: 404 }));
    await page.addInitScript(() => localStorage.setItem('lang', 'ja-JP'));
    await page.route('**/api/meta', route => route.fulfill({ json: { name: 'Test server' } }));
    let localeUrl;
    await page.route('**/assets/locales/**', route => {
      localeUrl = new URL(route.request().url()).pathname;
      return route.fulfill({ json: { follow: 'フォロー', unfollowConfirm: '{name}のフォローを解除しますか？' } });
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
    const labels = await page.evaluate(async () => {
      const { loadI18n } = await import('/src/services/locale.mjs');
      const i18n = await loadI18n();
      return [i18n.ts.follow, i18n.tsx.unfollowConfirm({ name: 'Alice' })];
    });
    const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
    assert.equal(decodeURIComponent(localeUrl), `/assets/locales/ja-JP.${version}.json`);
    assert.deepEqual(labels, ['フォロー', 'Aliceのフォローを解除しますか？']);
  } finally { await browser.close(); }
});

test('visitor stats honor activity settings and localize API counts', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('lang', 'ja-JP'));
    let show = true;
    let fail = false;
    let statsCalls = 0;
    await page.route('**/api/meta', route => route.fulfill({ json: { name: 'Test server', clientOptions: { showActivitiesForVisitor: show } } }));
    await page.route('**/assets/locales/**', route => route.fulfill({ json: { users: 'ユーザー', notes: 'ノート' } }));
    await page.route('**/api/stats', route => {
      statsCalls++;
      assert.equal(route.request().method(), 'POST');
      assert.deepEqual(route.request().postDataJSON(), {});
      if (fail) return route.fulfill({ status: 500, json: { error: {} } });
      return route.fulfill({ json: { originalUsersCount: 1234, originalNotesCount: 56789 } });
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
    await expect(page.locator('.visitor-stats-item').nth(0)).toHaveText('ユーザー1,234');
    await expect(page.locator('.visitor-stats-item').nth(1)).toHaveText('ノート56,789');
    assert.equal(statsCalls, 1);
    show = false;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test server' })).toBeVisible();
    await expect(page.locator('.visitor-stats')).toHaveCount(0);
    assert.equal(statsCalls, 1);
    show = true;
    fail = true;
    const failedResponse = page.waitForResponse(response => response.url().endsWith('/api/stats'));
    await page.reload();
    assert.equal((await failedResponse).status(), 500);
    await expect(page.locator('.visitor-stats')).toHaveCount(0);
    assert.equal(statsCalls, 2);
  } finally { await browser.close(); }
});
