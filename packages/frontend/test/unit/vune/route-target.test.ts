/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import type { ViewConstructor } from 'vune-ui';
import { isVuneRouteTarget, loadVuneRouteTarget, vuneRoute } from '@/vune/route-target.js';

const dummyView = {} as ViewConstructor;

describe('Vune route targets', () => {
	test('identifies only renderer-neutral Vune route targets', () => {
		const target = vuneRoute(async () => ({ default: dummyView }));

		expect(isVuneRouteTarget(target)).toBe(true);
		expect(isVuneRouteTarget({ kind: 'vune-route' })).toBe(false);
		expect(isVuneRouteTarget(null)).toBe(false);
	});

	test('deduplicates concurrent and settled lazy module loads', async () => {
		const loader = vi.fn(async () => ({ default: dummyView }));
		const target = vuneRoute(loader);

		const first = loadVuneRouteTarget(target);
		const second = loadVuneRouteTarget(target);

		expect(first).toBe(second);
		await expect(first).resolves.toEqual({ default: dummyView });
		await expect(loadVuneRouteTarget(target)).resolves.toEqual({ default: dummyView });
		expect(loader).toHaveBeenCalledTimes(1);
	});

	test('allows a failed lazy module request to be retried', async () => {
		const failure = new Error('first load failed');
		const loader = vi.fn()
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce({ default: dummyView });
		const target = vuneRoute(loader);

		await expect(loadVuneRouteTarget(target)).rejects.toBe(failure);
		await expect(loadVuneRouteTarget(target)).resolves.toEqual({ default: dummyView });
		expect(loader).toHaveBeenCalledTimes(2);
	});
});
