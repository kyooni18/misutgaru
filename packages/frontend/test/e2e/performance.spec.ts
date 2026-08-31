/* SPDX-License-Identifier: AGPL-3.0-only */

import { expect, test } from './fixtures.js';
import { BASE_URL, registerUser, resetState, signIn, visitHome } from './utils.js';
import type { Page } from '@playwright/test';

type PerfSnapshot = {
	domNodes: number;
	longTasks: number;
	longTaskDuration: number;
	navigationMs: number;
};

type IdlePerfSnapshot = {
	taskDuration: number;
	scriptDuration: number;
	recalcStyleDuration: number;
	recalcStyleCount: number;
	layoutDuration: number;
	layoutCount: number;
};

async function idlePerfSnapshot(page: Page, durationMs = 3000): Promise<IdlePerfSnapshot> {
	const session = await page.context().newCDPSession(page);
	await session.send('Performance.enable');
	const read = async () => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
	const before = await read();
	await page.waitForTimeout(durationMs);
	const after = await read();
	await session.detach();
	const delta = (name: string) => (after[name] ?? 0) - (before[name] ?? 0);
	return {
		taskDuration: delta('TaskDuration'),
		scriptDuration: delta('ScriptDuration'),
		recalcStyleDuration: delta('RecalcStyleDuration'),
		recalcStyleCount: delta('RecalcStyleCount'),
		layoutDuration: delta('LayoutDuration'),
		layoutCount: delta('LayoutCount'),
	};
}

test('setup animated background stays below display refresh rate', async ({ page }) => {
	await resetState();
	await page.addInitScript(() => {
		const original = window.requestAnimationFrame.bind(window);
		const counter = { count: 0 };
		Reflect.set(window, '__misutgaruPerfRafCounter', counter);
		window.requestAnimationFrame = callback => original(timestamp => {
			counter.count += 1;
			callback(timestamp);
		});
	});
	await page.goto(BASE_URL);
	await page.locator('button').first().waitFor({ state: 'visible', timeout: 30_000 });
	await page.waitForTimeout(1000);
	await page.evaluate(() => {
		const counter = Reflect.get(window, '__misutgaruPerfRafCounter') as { count: number } | undefined;
		if (counter) counter.count = 0;
	});
	await page.waitForTimeout(3000);
	const rafCallbacks = await page.evaluate(() => {
		return (Reflect.get(window, '__misutgaruPerfRafCounter') as { count: number } | undefined)?.count ?? 0;
	});

	// The shader targets 30 fps. Leave room for unrelated one-shot UI RAFs,
	// while still catching the old 60/120/144 Hz permanent animation loop.
	expect(rafCallbacks).toBeLessThan(140);
});

test('logged-out welcome becomes computationally idle after settling', async ({ page }) => {
	await resetState();
	await registerUser('perf_welcome', 'perf-pass', true);
	await page.addInitScript(() => {
		const original = window.requestAnimationFrame.bind(window);
		const counter = { count: 0 };
		Reflect.set(window, '__misutgaruPerfRafCounter', counter);
		window.requestAnimationFrame = callback => original(timestamp => {
			counter.count += 1;
			callback(timestamp);
		});
	});
	await page.goto(BASE_URL);
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(750);
	await page.evaluate(() => {
		const counter = Reflect.get(window, '__misutgaruPerfRafCounter') as { count: number } | undefined;
		if (counter) counter.count = 0;
	});

	const infiniteAnimations = await page.evaluate(() => document.getAnimations().filter(animation => {
		const timing = animation.effect?.getTiming();
		return animation.playState === 'running' && timing?.iterations === Infinity;
	}).length);
	const idle = await idlePerfSnapshot(page);
	const rafCallbacks = await page.evaluate(() => {
		return (Reflect.get(window, '__misutgaruPerfRafCounter') as { count: number } | undefined)?.count ?? 0;
	});

	// Decorative welcome content must not keep a completely idle tab repainting
	// at frame rate. Keep the budgets structural rather than machine-speed based.
	expect(infiniteAnimations).toBe(0);
	// Hidden reusable overlays such as chart tooltips must not keep a permanent
	// requestAnimationFrame positioning loop alive after the page settles.
	expect(rafCallbacks).toBeLessThan(30);
	expect(idle.recalcStyleCount).toBeLessThan(30);
	expect(idle.layoutCount).toBeLessThan(20);
	expect(idle.taskDuration).toBeLessThan(0.30);
});

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

		const idle = await idlePerfSnapshot(page);
		// Empty/quiet signed-in home should not continuously invalidate the whole
		// document. Dev-only UI may still produce a small amount of activity.
		expect(idle.recalcStyleCount).toBeLessThan(500);
		expect(idle.layoutCount).toBeLessThan(120);
	});
});

test('long timeline keeps mounted rows bounded after repeated pagination', async ({ page }) => {
	await resetState();
	const user = await registerUser('perf_list', 'perf-pass');
	// Seed enough notes to cross the real timeline virtualization threshold.
	// Keep creation sequential so the test exercises normal API ordering without
	// turning rate limiting into a benchmark variable.
	for (let i = 0; i < 120; i++) {
		const response = await page.request.post(`${BASE_URL}/api/notes/create`, {
			data: { i: user.token, text: `virtualized note ${i}` },
		});
		expect(response.ok()).toBe(true);
	}

	await signIn(page, 'perf_list', 'perf-pass');
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
