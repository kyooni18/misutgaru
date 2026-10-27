/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import config from './vite.config.mjs';
import { fileURLToPath } from 'node:url';
import { renderToHTML } from '@mun/web';

const server = await createServer({ ...config, root: fileURLToPath(new URL('.', import.meta.url)), configFile: false, server: { ...config.server, host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch();
const base = `http://127.0.0.1:${server.httpServer.address().port}/fixture.html`;
const errors = [];
async function page(query = '') {
  const p = await browser.newPage();
  p.on('pageerror', error => errors.push(error.message));
  await p.goto(base + query);
  await p.waitForFunction(() => window.fixture);
  return p;
}
try {
  globalThis.location = { search: '?following=1' };
  const ssr = await server.ssrLoadModule('/App.mun');
  assert.match(renderToHTML(ssr.default), /class="_button follow-button full active".*Following/);
  delete globalThis.location;
  const p = await page();
  const button = p.locator('button');
  assert.equal(await button.innerText(), 'Follow');
  await button.click();
  await p.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/create'));
  assert.equal(await button.isDisabled(), true);
  assert.match(await button.innerText(), /Processing/);
  assert.deepEqual(await p.evaluate(() => fixture.calls[2]), ['following/create', { userId: '1', withReplies: true }]);
  await p.evaluate(() => fixture.resolve({}));
  await p.waitForFunction(() => fixture.calls.some(c => c[0] === 'achievements'));
  assert.equal(await button.isDisabled(), false);
  assert.match(await button.getAttribute('class'), /active/);
  await p.evaluate(() => fixture.emit({ id: 'other', isFollowing: true, hasPendingFollowRequestFromYou: false }));
  assert.match(await button.innerText(), /Processing/);
  await p.evaluate(() => fixture.emit({ id: '1', isFollowing: true, hasPendingFollowRequestFromYou: false }));
  await p.waitForFunction(() => document.querySelector('button').textContent === 'Following');
  await button.click();
  await p.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/delete'));
  assert.deepEqual(await p.evaluate(() => fixture.calls.find(c => c[0] === 'confirm')), ['confirm', 'unfollow', 'alice']);
  await p.evaluate(() => fixture.resolve({}));
  await p.waitForFunction(() => !document.querySelector('button').disabled);
  await p.evaluate(() => fixture.cleanup());
  assert.equal(await p.evaluate(() => fixture.calls.at(-1)[0]), 'dispose');
  await p.close();

  const locked = await page('?pending=1&locked=1');
  await locked.waitForFunction(() => document.querySelector('button').textContent === 'Pending');
  await locked.locator('button').click();
  await locked.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/requests/cancel'));
  await locked.evaluate(() => fixture.resolve({}));
  await locked.waitForFunction(() => document.querySelector('button').textContent === 'Request');
  await locked.close();

  const canceled = await page('?following=1');
  await canceled.evaluate(() => { fixture.services.confirm = async () => true; });
  await canceled.locator('button').click();
  await canceled.waitForFunction(() => fixture.calls.some(c => c[0] === 'haptic') && !document.querySelector('button').disabled);
  assert.equal(await canceled.evaluate(() => fixture.calls.some(c => c[0] === 'following/delete')), false);
  assert.equal(await canceled.locator('button').innerText(), 'Following');
  await canceled.close();

  const denied = await page();
  await denied.evaluate(() => { fixture.services.login = async () => false; });
  await denied.locator('button').click();
  assert.deepEqual(await denied.evaluate(() => fixture.calls), []);
  assert.equal(await denied.locator('button').isDisabled(), false);
  await denied.close();

  const failed = await page();
  await failed.locator('button').click();
  await failed.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/create'));
  await failed.evaluate(() => fixture.reject('network failure'));
  await failed.waitForFunction(() => fixture.calls.some(c => c[0] === 'error'));
  assert.equal(await failed.locator('button').isDisabled(), false);
  assert.equal(await failed.locator('button').innerText(), 'Follow');
  await failed.close();

  // Vue checks the current account again after the request resolves.
  const signedOut = await page();
  await signedOut.locator('button').click();
  await signedOut.waitForFunction(() => fixture.calls.some(c => c[0] === 'following/create'));
  await signedOut.evaluate(() => { fixture.services.signedIn = () => false; fixture.resolve({}); });
  await signedOut.waitForFunction(() => !document.querySelector('button').disabled);
  assert.equal(await signedOut.evaluate(() => fixture.calls.some(c => c[0] === 'achievements')), false);
  assert.match(await signedOut.locator('button').innerText(), /Processing/);
  await signedOut.close();

  const missing = await page('?following=unknown');
  await missing.waitForFunction(() => fixture.calls.some(c => c[0] === 'users/show'));
  await missing.evaluate(() => fixture.resolve({ id: '1', isFollowing: true, hasPendingFollowRequestFromYou: false }));
  await missing.waitForFunction(() => document.querySelector('button').textContent === 'Following');
  await missing.close();
  assert.deepEqual(errors, []);
  console.log('PASS: native follow, cancellations, failed requests, stream updates, lookup, SSR, and cleanup');
} finally {
  await browser.close();
  await server.close();
}
