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
    await page.addInitScript(() => localStorage.setItem('account', JSON.stringify({ id: 'fixture-user', token: 'fixture-token' })));
    const requestSeen = new Promise(resolve => {
      page.route('**/api/meta', async route => {
        resolve(route.request().postDataJSON());
        await route.fulfill({ json: { name: 'Test server' } });
      });
    });
    await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/');
    assert.deepEqual(await requestSeen, { detail: true, i: 'fixture-token' });
    await expect(page.getByRole('heading', { name: 'Test server' })).toBeVisible();
  } finally { await browser.close(); }
});
