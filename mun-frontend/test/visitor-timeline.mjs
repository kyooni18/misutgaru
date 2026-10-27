// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

test('visitor timeline follows the Vue instance gates and request parameters', async () => {
  const browser = await chromium.launch();
  try {
    for (const [policy, setting, enabled] of [[true, true, true], [true, false, false], [false, true, false]]) {
      const page = await browser.newPage();
      const requests = [];
      await page.addInitScript(meta => { window.fixtureMeta = meta; }, { policies: { ltlAvailable: policy }, clientOptions: { showTimelineForVisitor: setting } });
      await page.route('**/api/notes/local-timeline', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: [] }); });
      await page.goto(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/test/fixtures/visitor-timeline.html`);
      await page.waitForFunction(() => window.fixtureMounted);
      if (enabled) {
        await expect(page.locator('.visitor-timeline-header')).toHaveText('Let’s look at the timeline');
        await expect(page.locator('.notes-timeline-empty')).toHaveText('No notes');
        assert.deepEqual(requests, [{ withRenotes: true, withReplies: false, limit: 15, allowPartial: true }]);
        assert.equal(await page.locator('.visitor-timeline-body').evaluate(el => getComputedStyle(el).height), '350px');
      } else {
        await expect(page.locator('.visitor-timeline')).toHaveCount(0);
        assert.deepEqual(requests, []);
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
