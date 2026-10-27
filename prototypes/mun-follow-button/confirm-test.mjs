/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, webkit } from '@playwright/test';
import config from './vite.config.mjs';
const server = await createServer({ ...config, root: fileURLToPath(new URL('.', import.meta.url)), configFile: false, server: { ...config.server, host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await ({ chromium, webkit })[process.env.PARITY_BROWSER ?? 'chromium'].launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/confirm-fixture.html`);
  const trigger = page.locator('#trigger');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Unfollow Alice?' });
  await dialog.waitFor();
  assert.equal(await page.locator('.mun-confirm').evaluate(el => el.classList.contains('animated')), true);
  assert.match(await page.locator('.mun-confirm-content').evaluate(el => getComputedStyle(el).animationDuration), /0\.1s, 0\.22s/);
  const ok = dialog.getByRole('button', { name: 'OK' }), cancel = dialog.getByRole('button', { name: 'Cancel' });
  await page.waitForFunction(() => document.activeElement?.dataset.testid === 'modal-dialog-ok');
  await page.evaluate(() => document.querySelector('#trigger').focus());
  assert.equal(await ok.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab'); assert.equal(await cancel.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await ok.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.result === true);
  await dialog.waitFor({ state: 'detached' }); assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  await trigger.click(); await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForFunction(() => window.result === false); await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => { window.result = null; }); await trigger.click();
  await page.mouse.click(2, 2);
  await page.waitForFunction(() => window.result === true); await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(`http://127.0.0.1:${server.httpServer.address().port}/confirm-fixture.html`);
  await reduced.locator('#trigger').click();
  await reduced.getByRole('alertdialog').waitFor();
  assert.equal(await reduced.locator('.mun-confirm').evaluate(el => el.classList.contains('animated')), false);
  await reduced.keyboard.press('Escape');
  await reduced.waitForFunction(() => window.result === true && !document.querySelector('.mun-confirm'));
  await reduced.close();
  await trigger.focus(); await page.keyboard.press('Enter');
  await dialog.waitFor();
  await page.evaluate(() => { window.nestedResult = null; window.openWithoutMotion().then(value => { window.nestedResult = value; }); });
  await page.getByRole('alertdialog', { name: 'Follow Alice?', exact: true }).waitFor();
  assert.equal(await page.getByRole('alertdialog').count(), 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.nestedResult?.canceled === true && document.querySelectorAll('[data-mun-confirm-active="true"]').length === 1);
  assert.equal(await page.getByRole('alertdialog', { name: 'Unfollow Alice?' }).count(), 1);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => { window.preferenceResult = null; window.openWithoutMotion().then(value => { window.preferenceResult = value; }); });
  await page.getByRole('alertdialog', { name: 'Follow Alice?', exact: true }).waitFor();
  assert.equal(await page.locator('.mun-confirm').evaluate(el => el.classList.contains('animated')), false);
  await page.getByRole('button', { name: 'No' }).click();
  await page.waitForFunction(() => window.preferenceResult?.canceled === true && !document.querySelector('.mun-confirm'));
  console.log('PASS: native confirmation with follow adapter, focus cycle, Escape, OK and backdrop cancellation');
} finally { await browser.close(); await server.close(); }
