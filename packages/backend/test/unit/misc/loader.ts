/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, describe, it } from 'vitest';
import { BatchLoader, DebounceLoader } from '@/misc/loader.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

class Mock {
	loadCountByKey = new Map<number, number>();
	load = async (key: number): Promise<number> => {
		const count = this.loadCountByKey.get(key);
		if (typeof count === 'undefined') {
			this.loadCountByKey.set(key, 1);
		} else {
			this.loadCountByKey.set(key, count + 1);
		}
		return key * 2;
	};
	reset() {
		this.loadCountByKey.clear();
	}
}

describe(DebounceLoader, () => {
	describe('single request', () => {
		it('loads once', async () => {
			const mock = new Mock();
			const loader = new DebounceLoader(mock.load);
			expect(await loader.load(7)).toBe(14);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(7)).toBe(1);
		});
	});

	describe('two duplicated requests at same time', () => {
		it('loads once', async () => {
			const mock = new Mock();
			const loader = new DebounceLoader(mock.load);
			const [v1, v2] = await Promise.all([
				loader.load(7),
				loader.load(7),
			]);
			expect(v1).toBe(14);
			expect(v2).toBe(14);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(7)).toBe(1);
		});
	});

	describe('two different requests at same time', () => {
		it('loads twice', async () => {
			const mock = new Mock();
			const loader = new DebounceLoader(mock.load);
			const [v1, v2] = await Promise.all([
				loader.load(7),
				loader.load(13),
			]);
			expect(v1).toBe(14);
			expect(v2).toBe(26);
			expect(mock.loadCountByKey.size).toBe(2);
			expect(mock.loadCountByKey.get(7)).toBe(1);
			expect(mock.loadCountByKey.get(13)).toBe(1);
		});
	});

	describe('non-continuous same two requests', () => {
		it('loads twice', async () => {
			const mock = new Mock();
			const loader = new DebounceLoader(mock.load);
			expect(await loader.load(7)).toBe(14);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(7)).toBe(1);
			mock.reset();
			expect(await loader.load(7)).toBe(14);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(7)).toBe(1);
		});
	});

	describe('non-continuous different two requests', () => {
		it('loads twice', async () => {
			const mock = new Mock();
			const loader = new DebounceLoader(mock.load);
			expect(await loader.load(7)).toBe(14);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(7)).toBe(1);
			mock.reset();
			expect(await loader.load(13)).toBe(26);
			expect(mock.loadCountByKey.size).toBe(1);
			expect(mock.loadCountByKey.get(13)).toBe(1);
		});
	});
});


describe(BatchLoader, () => {
	it('coalesces distinct keys into one repository batch and preserves order', async () => {
		const batches: number[][] = [];
		const loader = new BatchLoader<number, number>(async keys => {
			batches.push([...keys]);
			return new Map(keys.map(key => [key, key * 3]));
		});
		const result = await loader.loadMany([7, 13, 7, 2]);
		expect(result).toEqual([21, 39, 21, 6]);
		expect(batches).toEqual([[7, 13, 2]]);
	});

	it('rejects only the missing key while resolving siblings', async () => {
		const loader = new BatchLoader<number, number>(async keys => new Map(keys.filter(key => key !== 2).map(key => [key, key])));
		const [one, missing] = await Promise.allSettled([loader.load(1), loader.load(2)]);
		expect(one).toMatchObject({ status: 'fulfilled', value: 1 });
		expect(missing.status).toBe('rejected');
	});

	it('coalesces a key that is requested again while its batch is already in flight', async () => {
		let release!: () => void;
		let batches = 0;
		const loader = new BatchLoader<number, number>(async keys => {
			batches += 1;
			await new Promise<void>(resolve => { release = resolve; });
			return new Map(keys.map(key => [key, key * 2]));
		});
		const first = loader.load(7);
		await new Promise<void>(resolve => queueMicrotask(resolve));
		const second = loader.load(7);
		expect(second).toBe(first);
		expect(batches).toBe(1);
		release();
		await expect(Promise.all([first, second])).resolves.toEqual([14, 14]);
	});

	it('can memoize settled results for a request-scoped loader', async () => {
		let batches = 0;
		const loader = new BatchLoader<number, number>(
			async keys => {
				batches += 1;
				return new Map(keys.map(key => [key, key * 4]));
			},
			undefined,
			'test.request',
			true,
		);
		await expect(loader.load(3)).resolves.toBe(12);
		await expect(loader.load(3)).resolves.toBe(12);
		expect(batches).toBe(1);
	});

	it('does not retain settled results on a process-long fallback loader', async () => {
		let batches = 0;
		const loader = new BatchLoader<number, number>(async keys => {
			batches += 1;
			return new Map(keys.map(key => [key, key]));
		});
		await loader.load(1);
		await loader.load(1);
		expect(batches).toBe(2);
	});
	it('records per-loader batch metrics when a label is provided', async () => {
		runtimeDiagnostics.reset();
		const loader = new BatchLoader<number, number>(
			async keys => new Map(keys.map(key => [key, key])),
			key => new Error(`missing ${key}`),
			'note.channel',
		);
		await loader.loadMany([1, 2, 3]);
		const snapshot = runtimeDiagnostics.snapshot();
		expect(snapshot.counters['batchLoader.note.channel.flushes']).toBe(1);
		expect(snapshot.distributions['batchLoader.note.channel.batchSize']).toMatchObject({ count: 1, average: 3 });
	});

});
