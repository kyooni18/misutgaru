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
const browserName = process.env.SESSION_BROWSER ?? 'chromium';
if (!['chromium', 'webkit'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`);
const browser = await ({ chromium, webkit })[browserName].launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('account', JSON.stringify({ id: 'me', token: 'fixture-token', followingCount: 0, achievements: [] }));
    const cloud = location.search.includes('cloud=1');
    localStorage.setItem('preferences', JSON.stringify({ id: 'p', type: 'main', version: 'v', modifiedAt: 1, name: '', preferences: { defaultFollowWithReplies: [[{}, !cloud, cloud ? { sync: true } : {}]], ...(location.search.includes('haptic=1') ? { 'experimental.enableHapticFeedback': [[{}, true, {}]] } : {}) } }));
    window.vibrations = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: duration => { window.vibrations.push(duration); return true; } });
    window.sockets = [];
    window.WebSocket = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 0;
      constructor(url) { super(); this.url = url; this.messages = []; window.sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }); }
      send(data) { this.messages.push(JSON.parse(data)); }
      close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
      receive(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
    };
  });
  await page.route('**/assets/locales/**', route => route.fulfill({ json: { follow: 'Follow', followRequest: 'Request', processing: 'Processing', youFollowing: 'Following', followRequestPending: 'Pending', followConfirm: 'Follow {name}?', unfollowConfirm: 'Unfollow {name}?', cancelFollowRequestConfirm: 'Cancel {name}?', ok: 'OK', cancel: 'Cancel' } }));
  const calls = [];
  await page.route('**/api/**', route => { const path = new URL(route.request().url()).pathname; calls.push([path, route.request().postDataJSON()]); return path === '/api/i/registry/get' ? route.fulfill({ json: [[{}, true]] }) : route.fulfill({ status: 204 }); });
  const fixture = `http://127.0.0.1:${server.httpServer.address().port}/session-fixture.html`;
  await page.goto(fixture + '?haptic=1');
  await page.waitForFunction(() => window.sessionFixture && window.sockets.some(socket => socket.url.includes('/streaming?') && socket.messages.some(x => x.type === 'connect')));
  const button = page.locator('.follow-button');
  await button.click();
  assert.equal(await page.getByRole('alertdialog').getAttribute('aria-label'), 'Follow alice?');
  await page.getByTestId('modal-dialog-cancel').click();
  assert.equal(calls.length, 0);
  await button.click();
  const claimed = page.waitForResponse(response => response.url().endsWith('/api/i/claim-achievement'));
  await page.locator('[data-mun-confirm-active="true"] [data-testid="modal-dialog-ok"]').click();
  await page.waitForFunction(() => window.sessionFixture.updates.length === 1);
  await claimed;
  assert.deepEqual(calls, [['/api/following/create', { userId: 'alice', withReplies: true, i: 'fixture-token' }], ['/api/i/claim-achievement', { name: 'following1', i: 'fixture-token' }]]);
  await page.evaluate(() => { const socket = window.sockets.find(x => x.url.includes('/streaming?')); const id = socket.messages.find(x => x.type === 'connect').body.id; socket.receive({ type: 'channel', body: { id, type: 'follow', body: { id: 'alice', isFollowing: true, hasPendingFollowRequestFromYou: false } } }); });
  await page.waitForFunction(() => document.querySelector('.follow-button').textContent === 'Following');
  assert.deepEqual(await page.evaluate(() => window.vibrations), [50, 50]);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.sessionFixture.dispose());
  await page.goto(fixture);
  await page.waitForFunction(() => window.sessionFixture);
  await page.locator('.follow-button').click();
  await page.getByTestId('modal-dialog-cancel').click();
  assert.deepEqual(await page.evaluate(() => window.vibrations), []);
  const other = await context.newPage();
  await other.route('**/session-publisher', route => route.fulfill({ contentType: 'text/html', body: '<script type="module" src="/session-publisher.js"></script>' }));
  await other.goto(`http://127.0.0.1:${server.httpServer.address().port}/session-publisher`);
  await other.waitForFunction(() => window.publishPreferenceUpdate);
  await other.evaluate(async () => {
    const profile = JSON.parse(localStorage.getItem('preferences'));
    profile.preferences.alwaysConfirmFollow = [[{}, false, {}]];
    localStorage.setItem('preferences', JSON.stringify(profile));
    await window.publishPreferenceUpdate(Date.now());
  });
  await page.waitForFunction(() => window.sessionFixture.services.alwaysConfirmFollow === false);
  const withoutConfirmation = page.waitForResponse(response => response.url().endsWith('/api/following/create'));
  await page.locator('.follow-button').click();
  await withoutConfirmation;
  assert.equal(await page.locator('[data-mun-confirm-active="true"]').count(), 0);
  await other.close();
  await page.evaluate(() => window.sessionFixture.dispose());
  await page.goto(fixture + '?cloud=1');
  await page.waitForFunction(() => window.sessionFixture?.services.defaultFollowWithReplies === true);
  assert.ok(calls.some(([path, data]) => path === '/api/i/registry/get' && data.key === 'default:defaultFollowWithReplies' && data.i === 'fixture-token'));
  await page.locator('.follow-button').click();
  const cloudFollow = page.waitForResponse(response => response.url().endsWith('/api/following/create'));
  await page.getByTestId('modal-dialog-ok').click();
  await cloudFollow;
  assert.equal(calls.filter(([path]) => path === '/api/following/create').at(-1)[1].withReplies, true);
  await page.evaluate(() => window.sessionFixture.dispose());
  await page.close();
  console.log('PASS: native session confirmation, preferences, authenticated API, achievement and stream');
} finally { await browser.close(); await server.close(); }
