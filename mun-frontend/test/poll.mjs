/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const choices = () => [{ text: 'Apple', votes: 3, isVoted: false }, { text: 'Pear', votes: 1, isVoted: false }];

// Reference behavior from Vue MkPoll.
async function open(poll, { loggedIn = true, confirm = true } = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const votes = [];
  await page.route('**/api/notes/polls/vote', route => { votes.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); });
  await page.addInitScript(([p, l, c]) => { window.fixturePoll = p; window.fixtureLoggedIn = l; window.fixtureConfirm = c; }, [poll, loggedIn, confirm]);
  await page.goto(`${base}/test/fixtures/poll.html`);
  return { browser, page, votes };
}

test('open poll hides results until "show result", then shows counts and bar widths', async () => {
  const { browser, page } = await open({ multiple: false, expiresAt: '2026-01-01T00:01:30Z', choices: choices() });
  try {
    await expect(page.locator('.poll-votes')).toHaveCount(0);
    await expect(page.locator('.poll-info')).toContainText('4 total');
    await expect(page.locator('.poll-info')).toContainText('1m left');
    await page.getByText('Show result').click();
    await expect(page.locator('.poll-votes').first()).toHaveText('(3 votes)');
    await expect(page.locator('.poll-bg').first()).toHaveCSS('width', /./);
    assert.equal(await page.locator('.poll-bg').first().evaluate(e => e.style.width), '75%');
    await expect(page.getByText('Vote', { exact: true })).toBeVisible();
  } finally { await browser.close(); }
});

test('voting asks for login and confirmation, then POSTs notes/polls/vote with the choice index', async () => {
  const { browser, page, votes } = await open({ multiple: false, expiresAt: null, choices: choices() });
  try {
    await page.getByText('Pear').click();
    await expect.poll(() => votes.length).toBe(1);
    assert.deepEqual(votes[0], { noteId: 'n1', choice: 1 });
    assert.equal(await page.evaluate(() => window.fixtureConfirmed), 'Pear');
    await expect(page.locator('.poll-votes').first()).toBeVisible();
  } finally { await browser.close(); }
  const declined = await open({ multiple: false, expiresAt: null, choices: choices() }, { confirm: false });
  try {
    await declined.page.getByText('Apple').click();
    await declined.page.waitForTimeout(300);
    assert.equal(declined.votes.length, 0);
  } finally { await declined.browser.close(); }
  const anon = await open({ multiple: false, expiresAt: null, choices: choices() }, { loggedIn: false });
  try {
    await anon.page.getByText('Apple').click();
    await anon.page.waitForTimeout(300);
    assert.equal(anon.votes.length, 0);
  } finally { await anon.browser.close(); }
});

test('closed and already-voted polls show results, a status label, and ignore clicks', async () => {
  const closed = await open({ multiple: false, expiresAt: '2025-12-31T00:00:00Z', choices: choices() });
  try {
    await expect(closed.page.locator('.poll-info')).toContainText('Closed');
    await expect(closed.page.locator('.poll-votes')).toHaveCount(2);
    await closed.page.getByText('Apple').click();
    await closed.page.waitForTimeout(300);
    assert.equal(closed.votes.length, 0);
  } finally { await closed.browser.close(); }
  const voted = await open({ multiple: false, expiresAt: null, choices: [{ text: 'A', votes: 2, isVoted: true }, { text: 'B', votes: 0, isVoted: false }] });
  try {
    await expect(voted.page.locator('.poll-info')).toContainText('Voted');
    await expect(voted.page.locator('.poll-check')).toHaveCount(1);
  } finally { await voted.browser.close(); }
});
