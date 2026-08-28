/* SPDX-License-Identifier: AGPL-3.0-only */

import { expect, test } from './fixtures.js';
import { BASE_URL, registerUser, resetState, signIn, visitHome } from './utils.js';

type PerfSnapshot = {
	domNodes: number;
	longTasks: number;
	longTaskDuration: number;
	navigationMs: number;
};

test.describe('performance regression', () => {
	test.beforeEach(async ({ page }) => {
		await resetState();
		await registerUser('perf', 'perf-pass');
		await page.addInitScript(() => {
			const state = { longTasks: 0, longTaskDuration: 0 };
			Object.defineProperty(window, '__misutgaruPerf', { value: state, configurable: true });
			try {
				new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						state.longTasks += 1;
						state.longTaskDuration += entry.duration;
					}
				}).observe({ type: 'longtask', buffered: true });
			} catch {
				// Long Task API is optional; DOM/navigation budgets still run.
			}
		});
	});

	test('signed-in home stays inside broad runaway budgets', async ({ page }) => {
		await visitHome(page);
		await signIn(page, 'perf', 'perf-pass');
		await page.waitForLoadState('networkidle').catch(() => undefined);
		await page.waitForTimeout(750);
		const snapshot = await page.evaluate<PerfSnapshot>(() => {
			const state = (window as typeof window & { __misutgaruPerf?: { longTasks: number; longTaskDuration: number } }).__misutgaruPerf;
			const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
			return {
				domNodes: document.getElementsByTagName('*').length,
				longTasks: state?.longTasks ?? 0,
				longTaskDuration: state?.longTaskDuration ?? 0,
				navigationMs: navigation?.duration ?? 0,
			};
		});
		// These are intentionally generous runaway guards, not machine-speed benchmarks.
		expect(snapshot.domNodes).toBeLessThan(12_000);
		expect(snapshot.longTasks).toBeLessThan(120);
		expect(snapshot.longTaskDuration).toBeLessThan(12_000);
		expect(snapshot.navigationMs).toBeLessThan(30_000);
	});
});


test('long timeline keeps mounted rows bounded after repeated pagination', async ({ page }) => {
	await resetState();
	const user = await registerUser('perf-list', 'perf-pass');
	// Seed enough notes to cross the real timeline virtualization threshold.
	// Keep creation sequential so the test exercises normal API ordering without
	// turning rate limiting into a benchmark variable.
	for (let i = 0; i < 120; i++) {
		const response = await page.request.post(`${BASE_URL}/api/notes/create`, {
			data: { i: user.token, text: `virtualized note ${i}` },
		});
		expect(response.ok()).toBe(true);
	}

	await signIn(page, 'perf-list', 'perf-pass');
	await page.waitForTimeout(500);
	for (let i = 0; i < 5; i++) {
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await page.waitForTimeout(650);
	}

	const snapshot = await page.evaluate(() => ({
		rows: document.querySelectorAll('[data-virtual-index]').length,
		anchors: document.querySelectorAll('[data-scroll-anchor]').length,
		domNodes: document.getElementsByTagName('*').length,
	}));
	// The paginator may retain hundreds of Note identities, but layout/DOM work
	// must stay proportional to the viewport once virtualization is active.
	expect(snapshot.rows).toBeLessThan(60);
	expect(snapshot.anchors).toBeLessThan(90);
	expect(snapshot.domNodes).toBeLessThan(12_000);
});
