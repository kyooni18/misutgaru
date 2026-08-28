/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { Cache } from '@/utility/cache.js';

describe('frontend Cache', () => {
	test('coalesces concurrent misses', async () => {
		let resolve!: (value: string) => void;
		const fetcher = vi.fn(() => new Promise<string>(r => { resolve = r; }));
		const cache = new Cache(10_000, fetcher);
		const a = cache.fetch();
		const b = cache.fetch();
		expect(fetcher).toHaveBeenCalledOnce();
		resolve('value');
		await expect(Promise.all([a, b])).resolves.toEqual(['value', 'value']);
	});

	test('does not overwrite a newer explicit set with a late fetch', async () => {
		let resolve!: (value: string) => void;
		const cache = new Cache(10_000, () => new Promise<string>(r => { resolve = r; }));
		const fetching = cache.fetch();
		cache.set('fresh');
		resolve('stale');
		await expect(fetching).resolves.toBe('fresh');
		await expect(cache.fetch()).resolves.toBe('fresh');
	});

	test('a delete prevents a late fetch from repopulating the cache', async () => {
		let resolveFirst!: (value: string) => void;
		const fetcher = vi.fn()
			.mockImplementationOnce(() => new Promise<string>(r => { resolveFirst = r; }))
			.mockResolvedValueOnce('second');
		const cache = new Cache(10_000, fetcher);
		const first = cache.fetch();
		cache.delete();
		resolveFirst('stale');
		await expect(first).resolves.toBe('second');
		await expect(cache.fetch()).resolves.toBe('second');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
