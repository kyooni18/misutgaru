/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryKVCache, MemorySingleCache, RedisKVCache, RedisSingleCache } from '@/misc/cache.js';

function redisStub() {
	return {
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue('OK'),
		del: vi.fn().mockResolvedValue(1),
	};
}

describe('misc:RedisKVCache', () => {
	test('coalesces concurrent Redis misses and backend fetches per key', async () => {
		const redis = redisStub();
		let resolveFetch!: (value: string) => void;
		const fetcher = vi.fn(() => new Promise<string>(resolve => {
			resolveFetch = resolve;
		}));
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const first = cache.fetch('key');
		const second = cache.fetch('key');
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

		resolveFetch('fetched');
		await expect(Promise.all([first, second])).resolves.toEqual(['fetched', 'fetched']);
		expect(redis.get).toHaveBeenCalledOnce();
		expect(redis.set).toHaveBeenCalledOnce();
		cache.dispose();
	});

	test('keeps an explicit set authoritative over an in-flight cache fill', async () => {
		const redis = redisStub();
		let releaseStaleWrite!: () => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>(resolve => {
				releaseStaleWrite = () => resolve('OK');
			}))
			.mockResolvedValue('OK');
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('stale'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch('key');
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		const setting = cache.set('key', 'fresh');
		expect(redis.set).toHaveBeenCalledOnce();

		releaseStaleWrite();
		await Promise.all([filling, setting]);
		expect(redis.set).toHaveBeenLastCalledWith('kvcache:test:key', 'fresh', 'EX', 1);
		await expect(cache.get('key')).resolves.toBe('fresh');
		cache.dispose();
	});

	test('returns a superseding set when an invalidated cache-fill write fails', async () => {
		const redis = redisStub();
		let rejectStaleWrite!: (error: Error) => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>((_resolve, reject) => {
				rejectStaleWrite = reject;
			}))
			.mockResolvedValue('OK');
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('stale'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch('key');
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		const setting = cache.set('key', 'fresh');
		rejectStaleWrite(new Error('stale write failed'));

		await expect(setting).resolves.toBeUndefined();
		await expect(filling).resolves.toBe('fresh');
		expect(redis.set).toHaveBeenLastCalledWith('kvcache:test:key', 'fresh', 'EX', 1);
		cache.dispose();
	});

	test('does not make an explicit set wait for a fetcher that has not started writing', async () => {
		const redis = redisStub();
		let resolveFetch!: (value: string) => void;
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: () => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch('key');
		await vi.waitFor(() => expect(resolveFetch).toBeTypeOf('function'));
		await cache.set('key', 'fresh');
		expect(redis.set).toHaveBeenCalledOnce();

		resolveFetch('stale');
		await expect(filling).resolves.toBe('fresh');
		await expect(cache.get('key')).resolves.toBe('fresh');
		cache.dispose();
	});

	test('does not return a Redis snapshot invalidated by a concurrent set', async () => {
		const redis = redisStub();
		let resolveRedisRead!: (value: string | null) => void;
		redis.get
			.mockImplementationOnce(() => new Promise<string | null>(resolve => {
				resolveRedisRead = resolve;
			}))
			.mockResolvedValueOnce('fresh');
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch('key');
		await vi.waitFor(() => expect(redis.get).toHaveBeenCalledOnce());
		await cache.set('key', 'fresh');
		resolveRedisRead('stale');

		await expect(filling).resolves.toBe('fresh');
		expect(redis.get).toHaveBeenCalledTimes(2);
		cache.dispose();
	});

	test('does not return a Redis snapshot invalidated by a concurrent delete', async () => {
		const redis = redisStub();
		let resolveRedisRead!: (value: string | null) => void;
		redis.get
			.mockImplementationOnce(() => new Promise<string | null>(resolve => {
				resolveRedisRead = resolve;
			}))
			.mockResolvedValueOnce(null);
		const fetcher = vi.fn().mockResolvedValue('backend');
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch('key');
		await vi.waitFor(() => expect(redis.get).toHaveBeenCalledOnce());
		await cache.delete('key');
		resolveRedisRead('stale');

		await expect(filling).resolves.toBe('backend');
		expect(fetcher).toHaveBeenCalledOnce();
		expect(redis.del).toHaveBeenCalledWith('kvcache:test:key');
		cache.dispose();
	});

	test('serializes refresh and explicit set so the later set wins', async () => {
		const redis = redisStub();
		let resolveRefresh!: (value: string) => void;
		const fetcher = vi.fn(() => new Promise<string>(resolve => {
			resolveRefresh = resolve;
		}));
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const refreshing = cache.refresh('key');
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
		const setting = cache.set('key', 'fresh');
		expect(redis.set).not.toHaveBeenCalled();

		resolveRefresh('refreshed');
		await Promise.all([refreshing, setting]);
		expect(redis.set).toHaveBeenNthCalledWith(1, 'kvcache:test:key', 'refreshed', 'EX', 1);
		expect(redis.set).toHaveBeenNthCalledWith(2, 'kvcache:test:key', 'fresh', 'EX', 1);
		await expect(cache.get('key')).resolves.toBe('fresh');
		cache.dispose();
	});

	test('serializes explicit writes so the last set wins', async () => {
		const redis = redisStub();
		let releaseFirstWrite!: () => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>(resolve => {
				releaseFirstWrite = () => resolve('OK');
			}))
			.mockResolvedValue('OK');
		const cache = new RedisKVCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const first = cache.set('key', 'first');
		const second = cache.set('key', 'second');
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		releaseFirstWrite();
		await Promise.all([first, second]);

		expect(redis.set).toHaveBeenNthCalledWith(1, 'kvcache:test:key', 'first', 'EX', 1);
		expect(redis.set).toHaveBeenNthCalledWith(2, 'kvcache:test:key', 'second', 'EX', 1);
		await expect(cache.get('key')).resolves.toBe('second');
		cache.dispose();
	});
});

describe('misc:RedisSingleCache', () => {
	test('coalesces concurrent Redis misses and backend fetches', async () => {
		const redis = redisStub();
		let resolveFetch!: (value: string) => void;
		const fetcher = vi.fn(() => new Promise<string>(resolve => {
			resolveFetch = resolve;
		}));
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const first = cache.fetch();
		const second = cache.fetch();
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

		resolveFetch('fetched');
		await expect(Promise.all([first, second])).resolves.toEqual(['fetched', 'fetched']);
		expect(redis.get).toHaveBeenCalledOnce();
		expect(redis.set).toHaveBeenCalledOnce();
		cache.dispose();
	});

	test('keeps an explicit set authoritative over an in-flight cache fill', async () => {
		const redis = redisStub();
		let releaseStaleWrite!: () => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>(resolve => {
				releaseStaleWrite = () => resolve('OK');
			}))
			.mockResolvedValue('OK');
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('stale'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch();
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		const setting = cache.set('fresh');
		expect(redis.set).toHaveBeenCalledOnce();

		releaseStaleWrite();
		await Promise.all([filling, setting]);
		expect(redis.set).toHaveBeenLastCalledWith('singlecache:test', 'fresh', 'EX', 1);
		await expect(cache.get()).resolves.toBe('fresh');
		cache.dispose();
	});

	test('returns a superseding set when an invalidated cache-fill write fails', async () => {
		const redis = redisStub();
		let rejectStaleWrite!: (error: Error) => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>((_resolve, reject) => {
				rejectStaleWrite = reject;
			}))
			.mockResolvedValue('OK');
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('stale'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch();
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		const setting = cache.set('fresh');
		rejectStaleWrite(new Error('stale write failed'));

		await expect(setting).resolves.toBeUndefined();
		await expect(filling).resolves.toBe('fresh');
		expect(redis.set).toHaveBeenLastCalledWith('singlecache:test', 'fresh', 'EX', 1);
		cache.dispose();
	});

	test('does not make an explicit set wait for a fetcher that has not started writing', async () => {
		const redis = redisStub();
		let resolveFetch!: (value: string) => void;
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: () => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch();
		await vi.waitFor(() => expect(resolveFetch).toBeTypeOf('function'));
		await cache.set('fresh');
		expect(redis.set).toHaveBeenCalledOnce();

		resolveFetch('stale');
		await expect(filling).resolves.toBe('fresh');
		await expect(cache.get()).resolves.toBe('fresh');
		cache.dispose();
	});

	test('does not return a Redis snapshot invalidated by a concurrent set', async () => {
		const redis = redisStub();
		let resolveRedisRead!: (value: string | null) => void;
		redis.get
			.mockImplementationOnce(() => new Promise<string | null>(resolve => {
				resolveRedisRead = resolve;
			}))
			.mockResolvedValueOnce('fresh');
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch();
		await vi.waitFor(() => expect(redis.get).toHaveBeenCalledOnce());
		await cache.set('fresh');
		resolveRedisRead('stale');

		await expect(filling).resolves.toBe('fresh');
		expect(redis.get).toHaveBeenCalledTimes(2);
		cache.dispose();
	});

	test('does not return a Redis snapshot invalidated by a concurrent delete', async () => {
		const redis = redisStub();
		let resolveRedisRead!: (value: string | null) => void;
		redis.get
			.mockImplementationOnce(() => new Promise<string | null>(resolve => {
				resolveRedisRead = resolve;
			}))
			.mockResolvedValueOnce(null);
		const fetcher = vi.fn().mockResolvedValue('backend');
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const filling = cache.fetch();
		await vi.waitFor(() => expect(redis.get).toHaveBeenCalledOnce());
		await cache.delete();
		resolveRedisRead('stale');

		await expect(filling).resolves.toBe('backend');
		expect(fetcher).toHaveBeenCalledOnce();
		expect(redis.del).toHaveBeenCalledWith('singlecache:test');
		cache.dispose();
	});

	test('serializes refresh and explicit set so the later set wins', async () => {
		const redis = redisStub();
		let resolveRefresh!: (value: string) => void;
		const fetcher = vi.fn(() => new Promise<string>(resolve => {
			resolveRefresh = resolve;
		}));
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher,
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const refreshing = cache.refresh();
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
		const setting = cache.set('fresh');
		expect(redis.set).not.toHaveBeenCalled();

		resolveRefresh('refreshed');
		await Promise.all([refreshing, setting]);
		expect(redis.set).toHaveBeenNthCalledWith(1, 'singlecache:test', 'refreshed', 'EX', 1);
		expect(redis.set).toHaveBeenNthCalledWith(2, 'singlecache:test', 'fresh', 'EX', 1);
		await expect(cache.get()).resolves.toBe('fresh');
		cache.dispose();
	});

	test('serializes explicit writes so the last set wins', async () => {
		const redis = redisStub();
		let releaseFirstWrite!: () => void;
		redis.set
			.mockImplementationOnce(() => new Promise<string>(resolve => {
				releaseFirstWrite = () => resolve('OK');
			}))
			.mockResolvedValue('OK');
		const cache = new RedisSingleCache<string>(redis as never, 'test', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});

		const first = cache.set('first');
		const second = cache.set('second');
		await vi.waitFor(() => expect(redis.set).toHaveBeenCalledOnce());
		releaseFirstWrite();
		await Promise.all([first, second]);

		expect(redis.set).toHaveBeenNthCalledWith(1, 'singlecache:test', 'first', 'EX', 1);
		expect(redis.set).toHaveBeenNthCalledWith(2, 'singlecache:test', 'second', 'EX', 1);
		await expect(cache.get()).resolves.toBe('second');
		cache.dispose();
	});
});

describe('misc:MemoryKVCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('set and get returns the value within lifetime', () => {
		const cache = new MemoryKVCache<string>(1000);
		cache.set('key', 'value');
		expect(cache.get('key')).toBe('value');
		cache.dispose();
	});

	test('get returns undefined after lifetime expires', () => {
		const cache = new MemoryKVCache<string>(1000);
		cache.set('key', 'value');
		vi.advanceTimersByTime(1001);
		expect(cache.get('key')).toBeUndefined();
		cache.dispose();
	});

	test('delete removes the entry', () => {
		const cache = new MemoryKVCache<string>(1000);
		cache.set('key', 'value');
		cache.delete('key');
		expect(cache.get('key')).toBeUndefined();
		cache.dispose();
	});

	test('does not evict live entries when limit is omitted', () => {
		const cache = new MemoryKVCache<number>(1000 * 60);
		for (let i = 0; i < 4097; i++) cache.set(String(i), i);
		expect(cache.get('0')).toBe(0);
		expect(cache.get('4096')).toBe(4096);
		cache.dispose();
	});

	test('evicts least recently used entry when limit is reached', () => {
		const cache = new MemoryKVCache<number>(1000 * 60, 2);
		cache.set('a', 1);
		cache.set('b', 2);
		expect(cache.get('a')).toBe(1);
		cache.set('c', 3);
		expect(cache.get('a')).toBe(1);
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('c')).toBe(3);
		cache.dispose();
	});

	describe('gc()', () => {
		test('removes expired entries', () => {
			const cache = new MemoryKVCache<string>(1000);
			cache.set('a', '1');
			cache.set('b', '2');
			vi.advanceTimersByTime(1001);
			cache.gc();
			expect(cache.get('a')).toBeUndefined();
			expect(cache.get('b')).toBeUndefined();
			cache.dispose();
		});

		test('retains entries that have not yet expired', () => {
			const cache = new MemoryKVCache<string>(2000);
			cache.set('a', '1');
			vi.advanceTimersByTime(1001);
			cache.gc();
			expect(cache.get('a')).toBe('1');
			cache.dispose();
		});

		test('removes only expired entries when mixed with live entries', () => {
			const cache = new MemoryKVCache<string>(2000);
			cache.set('old', 'oldValue');
			vi.advanceTimersByTime(2001);
			cache.set('new', 'newValue');
			cache.gc();
			expect(cache.get('old')).toBeUndefined();
			expect(cache.get('new')).toBe('newValue');
			cache.dispose();
		});

		// Regression test for https://github.com/misskey-dev/misskey/issues/15500
		// Updated keys keep their original insertion position in Map. gc() must not
		// assume that entries are ordered from oldest to youngest, otherwise it can
		// stop early at an updated key and leave later, truly-expired keys alive.
		// The key observable symptom is that gc() fails to *remove* the expired entry
		// from the Map — get() has its own expiry check so it returns undefined either
		// way, but the stale entry keeps consuming memory.
		test('correctly expires old entries after a key is updated (issue #15500)', () => {
			const lifetime = 1000;
			const cache = new MemoryKVCache<string>(lifetime);

			// Insert 'a' and 'b' at t=0
			cache.set('a', 'v1');
			cache.set('b', 'v1');

			// Advance time and update 'a'. It stays at position 0 in the Map, so a
			// gc() implementation that stops at the first fresh entry would leave 'b'
			// in the Map even though get() would hide it as expired.
			vi.advanceTimersByTime(500);
			cache.set('a', 'v2'); // refresh 'a'; 'b' is still at t=0

			// 'b' is now expired, 'a' has 400ms left
			vi.advanceTimersByTime(600); // total 1100ms

			cache.gc();

			// Verify the entry is actually removed from the Map, not just hidden by get().
			// get() always checks expiry itself, so it returns undefined even without gc() —
			// the real bug is memory not being freed.
			const entries = [...cache.entries];
			expect(entries.find(([k]) => k === 'b')).toBeUndefined(); // 'b' must be gone from Map
			expect(entries.find(([k]) => k === 'a')?.[1].value).toBe('v2'); // 'a' still in Map
			cache.dispose();
		});

		test('gc does not break when cache is empty', () => {
			const cache = new MemoryKVCache<string>(1000);
			expect(() => cache.gc()).not.toThrow();
			cache.dispose();
		});
	});

	test('set does not cause active entries iteration to revisit the same key', () => {
		const cache = new MemoryKVCache<{ id: string }>(1000);
		cache.set('key', { id: 'user-1' });

		let iterations = 0;
		for (const [key, { value }] of cache.entries) {
			iterations++;
			if (value.id === 'user-1') {
				cache.set(key, value);
			}

			expect(iterations).toBeLessThan(3);
		}

		expect(iterations).toBe(1);
		cache.dispose();
	});

	describe('fetch()', () => {
		test('calls fetcher on cache miss', async () => {
			const cache = new MemoryKVCache<string>(1000);
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch('key', fetcher);
			expect(fetcher).toHaveBeenCalledOnce();
			expect(result).toBe('fetched');
			cache.dispose();
		});

		test('does not call fetcher on cache hit', async () => {
			const cache = new MemoryKVCache<string>(1000);
			cache.set('key', 'cached');
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch('key', fetcher);
			expect(fetcher).not.toHaveBeenCalled();
			expect(result).toBe('cached');
			cache.dispose();
		});

		test('respects validator and bypasses cache when validator returns false', async () => {
			const cache = new MemoryKVCache<string>(1000);
			cache.set('key', 'cached');
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch('key', fetcher, () => false);
			expect(fetcher).toHaveBeenCalledOnce();
			expect(result).toBe('fetched');
			cache.dispose();
		});

		test('coalesces concurrent misses for the same key', async () => {
			const cache = new MemoryKVCache<string>(1000);
			let resolveFetch!: (value: string) => void;
			const fetcher = vi.fn(() => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}));

			const first = cache.fetch('key', fetcher);
			const second = cache.fetch('key', fetcher);

			expect(fetcher).toHaveBeenCalledOnce();
			resolveFetch('fetched');
			await expect(Promise.all([first, second])).resolves.toEqual(['fetched', 'fetched']);
			expect(cache.get('key')).toBe('fetched');
			cache.dispose();
		});

		test('does not repopulate an entry deleted during an in-flight fetch', async () => {
			const cache = new MemoryKVCache<string>(1000);
			let resolveFetch!: (value: string) => void;
			const pending = cache.fetch('key', () => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}));

			cache.delete('key');
			resolveFetch('stale');
			await expect(pending).resolves.toBe('stale');
			expect(cache.get('key')).toBeUndefined();
			cache.dispose();
		});

		test('keeps an explicit set authoritative over an in-flight fetch', async () => {
			const cache = new MemoryKVCache<string>(1000);
			let resolveFetch!: (value: string) => void;
			const pending = cache.fetch('key', () => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}));

			cache.set('key', 'fresh');
			resolveFetch('stale');
			await expect(pending).resolves.toBe('stale');
			expect(cache.get('key')).toBe('fresh');
			cache.dispose();
		});
	});

	describe('fetchMaybe()', () => {
		test('does not cache undefined returned by fetcher', async () => {
			const cache = new MemoryKVCache<string>(1000);
			const fetcher = vi.fn().mockResolvedValue(undefined);
			const result = await cache.fetchMaybe('key', fetcher);
			expect(result).toBeUndefined();
			// A second call should invoke the fetcher again because undefined was not cached
			await cache.fetchMaybe('key', fetcher);
			expect(fetcher).toHaveBeenCalledTimes(2);
			cache.dispose();
		});

		test('coalesces concurrent misses for the same key', async () => {
			const cache = new MemoryKVCache<string>(1000);
			let resolveFetch!: (value: string | undefined) => void;
			const fetcher = vi.fn(() => new Promise<string | undefined>(resolve => {
				resolveFetch = resolve;
			}));

			const first = cache.fetchMaybe('key', fetcher);
			const second = cache.fetchMaybe('key', fetcher);

			expect(fetcher).toHaveBeenCalledOnce();
			resolveFetch('fetched');
			await expect(Promise.all([first, second])).resolves.toEqual(['fetched', 'fetched']);
			cache.dispose();
		});
	});
});

describe('misc:MemorySingleCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('set and get returns the value within lifetime', () => {
		const cache = new MemorySingleCache<string>(1000);
		cache.set('value');
		expect(cache.get()).toBe('value');
	});

	test('get returns undefined after lifetime expires', () => {
		const cache = new MemorySingleCache<string>(1000);
		cache.set('value');
		vi.advanceTimersByTime(1001);
		expect(cache.get()).toBeUndefined();
	});

	test('delete removes the cached value', () => {
		const cache = new MemorySingleCache<string>(1000);
		cache.set('value');
		cache.delete();
		expect(cache.get()).toBeUndefined();
	});

	describe('fetch()', () => {
		test('calls fetcher on cache miss', async () => {
			const cache = new MemorySingleCache<string>(1000);
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch(fetcher);
			expect(fetcher).toHaveBeenCalledOnce();
			expect(result).toBe('fetched');
		});

		test('does not call fetcher on cache hit', async () => {
			const cache = new MemorySingleCache<string>(1000);
			cache.set('cached');
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch(fetcher);
			expect(fetcher).not.toHaveBeenCalled();
			expect(result).toBe('cached');
		});

		test('respects validator and bypasses cache when validator returns false', async () => {
			const cache = new MemorySingleCache<string>(1000);
			cache.set('cached');
			const fetcher = vi.fn().mockResolvedValue('fetched');
			const result = await cache.fetch(fetcher, () => false);
			expect(fetcher).toHaveBeenCalledOnce();
			expect(result).toBe('fetched');
		});

		test('coalesces concurrent misses', async () => {
			const cache = new MemorySingleCache<string>(1000);
			let resolveFetch!: (value: string) => void;
			const fetcher = vi.fn(() => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}));

			const first = cache.fetch(fetcher);
			const second = cache.fetch(fetcher);

			expect(fetcher).toHaveBeenCalledOnce();
			resolveFetch('fetched');
			await expect(Promise.all([first, second])).resolves.toEqual(['fetched', 'fetched']);
		});

		test('keeps an explicit set authoritative over an in-flight fetch', async () => {
			const cache = new MemorySingleCache<string>(1000);
			let resolveFetch!: (value: string) => void;
			const pending = cache.fetch(() => new Promise<string>(resolve => {
				resolveFetch = resolve;
			}));

			cache.set('fresh');
			resolveFetch('stale');
			await expect(pending).resolves.toBe('stale');
			expect(cache.get()).toBe('fresh');
		});
	});
});

describe('misc:Redis cache invalidation bus', () => {
	test('does not resurrect a KV value when a remote invalidation lands during a local write', async () => {
		const redis = redisStub();
		let releaseWrite!: () => void;
		redis.set.mockImplementationOnce(() => new Promise<string>(resolve => {
			releaseWrite = () => resolve('OK');
		}));
		const listeners = new Set<(key: string | null) => void>();
		const bus = {
			register(_name: string, listener: (key: string | null) => void) { listeners.add(listener); return () => listeners.delete(listener); },
			publish: vi.fn().mockResolvedValue(undefined),
		};
		const cache = new RedisKVCache<string>(redis as never, 'shared-race', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
			invalidationBus: bus,
		});

		const writing = cache.set('key', 'local-write');
		await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));
		for (const listener of listeners) listener('key');
		releaseWrite();
		await writing;

		redis.get.mockResolvedValueOnce('remote-authoritative');
		await expect(cache.get('key')).resolves.toBe('remote-authoritative');
		cache.dispose();
	});

	test('an explicit KV mutation removes the old memory value before its Redis write completes', async () => {
		const redis = redisStub();
		const cache = new RedisKVCache<string>(redis as never, 'local-mutation-race', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
		});
		await cache.set('key', 'old');
		let releaseWrite!: () => void;
		redis.set.mockImplementationOnce(() => new Promise<string>(resolve => {
			releaseWrite = () => resolve('OK');
		}));

		const writing = cache.set('key', 'fresh');
		let readSettled = false;
		const reading = cache.fetch('key').finally(() => { readSettled = true; });
		await Promise.resolve();
		expect(readSettled).toBe(false);
		releaseWrite();
		await expect(Promise.all([writing, reading])).resolves.toEqual([undefined, 'fresh']);
		cache.dispose();
	});

	test('remote invalidation drops a KV memory snapshot and refills from Redis', async () => {
		const redis = redisStub();
		const listeners = new Map<string, Set<(key: string | null) => void>>();
		const bus = {
			register(name: string, listener: (key: string | null) => void) {
				let set = listeners.get(name);
				if (!set) listeners.set(name, set = new Set());
				set.add(listener);
				return () => set!.delete(listener);
			},
			publish: vi.fn().mockResolvedValue(undefined),
			remote(name: string, key: string | null) {
				for (const listener of listeners.get(name) ?? []) listener(key);
			},
		};
		const cache = new RedisKVCache<string>(redis as never, 'shared', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
			invalidationBus: bus,
		});
		await cache.set('key', 'local');
		expect(await cache.get('key')).toBe('local');
		redis.get.mockResolvedValueOnce('remote');
		bus.remote('shared', 'key');
		expect(await cache.get('key')).toBe('remote');
		cache.dispose();
	});

	test('does not resurrect a single-value snapshot when remote invalidation lands during a local write', async () => {
		const redis = redisStub();
		let releaseWrite!: () => void;
		redis.set.mockImplementationOnce(() => new Promise<string>(resolve => {
			releaseWrite = () => resolve('OK');
		}));
		const listeners = new Set<(key: string | null) => void>();
		const bus = {
			register(_name: string, listener: (key: string | null) => void) { listeners.add(listener); return () => listeners.delete(listener); },
			publish: vi.fn().mockResolvedValue(undefined),
		};
		const cache = new RedisSingleCache<string>(redis as never, 'shared-single-race', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
			invalidationBus: bus,
		});

		const writing = cache.set('local-write');
		await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));
		for (const listener of listeners) listener(null);
		releaseWrite();
		await writing;

		redis.get.mockResolvedValueOnce('remote-authoritative');
		await expect(cache.get()).resolves.toBe('remote-authoritative');
		cache.dispose();
	});

	test('remote invalidation drops a single-value memory snapshot', async () => {
		const redis = redisStub();
		const listeners = new Set<(key: string | null) => void>();
		const bus = {
			register(_name: string, listener: (key: string | null) => void) { listeners.add(listener); return () => listeners.delete(listener); },
			publish: vi.fn().mockResolvedValue(undefined),
		};
		const cache = new RedisSingleCache<string>(redis as never, 'shared-single', {
			lifetime: 1000,
			memoryCacheLifetime: 1000,
			fetcher: vi.fn().mockResolvedValue('backend'),
			toRedisConverter: value => value,
			fromRedisConverter: value => value,
			invalidationBus: bus,
		});
		await cache.set('local');
		redis.get.mockResolvedValueOnce('remote');
		for (const listener of listeners) listener(null);
		expect(await cache.get()).toBe('remote');
		cache.dispose();
	});
});
