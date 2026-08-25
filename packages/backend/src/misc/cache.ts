/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Redis from 'ioredis';
import { bindThis } from '@/decorators.js';

const DEFAULT_MEMORY_KV_CACHE_LIMIT = 4096;

type GcTarget = { gc(): void };
const memoryKvCaches = new Set<GcTarget>();
let memoryKvGcIntervalHandle: NodeJS.Timeout | null = null;

function registerMemoryKvCache(cache: GcTarget): void {
	memoryKvCaches.add(cache);
	if (memoryKvGcIntervalHandle == null) {
		memoryKvGcIntervalHandle = setInterval(() => {
			for (const target of memoryKvCaches) target.gc();
		}, 1000 * 60 * 3);
	}
}

function unregisterMemoryKvCache(cache: GcTarget): void {
	memoryKvCaches.delete(cache);
	if (memoryKvCaches.size === 0 && memoryKvGcIntervalHandle != null) {
		clearInterval(memoryKvGcIntervalHandle);
		memoryKvGcIntervalHandle = null;
	}
}

export class RedisKVCache<T> {
	private readonly lifetime: number;
	private readonly memoryCache: MemoryKVCache<T>;
	private readonly fetcher: (key: string) => Promise<T>;
	private readonly pendingFetches = new Map<string, { promise: Promise<T>; invalidated: boolean }>();
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;

	constructor(
		private redisClient: Redis.Redis,
		private name: string,
		opts: {
			lifetime: RedisKVCache<T>['lifetime'];
			memoryCacheLifetime: number;
			fetcher: RedisKVCache<T>['fetcher'];
			toRedisConverter: RedisKVCache<T>['toRedisConverter'];
			fromRedisConverter: RedisKVCache<T>['fromRedisConverter'];
		},
	) {
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemoryKVCache(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
	}

	@bindThis
	public async set(key: string, value: T): Promise<void> {
		this.memoryCache.set(key, value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(
				`kvcache:${this.name}:${key}`,
				this.toRedisConverter(value),
			);
		} else {
			await this.redisClient.set(
				`kvcache:${this.name}:${key}`,
				this.toRedisConverter(value),
				'EX', Math.round(this.lifetime / 1000),
			);
		}
	}

	@bindThis
	public async get(key: string): Promise<T | undefined> {
		const memoryCached = this.memoryCache.get(key);
		if (memoryCached !== undefined) return memoryCached;

		const cached = await this.redisClient.get(`kvcache:${this.name}:${key}`);
		if (cached == null) return undefined;

		const value = this.fromRedisConverter(cached);
		if (value !== undefined) {
			this.memoryCache.set(key, value);
		}

		return value;
	}

	@bindThis
	public async delete(key: string): Promise<void> {
		const pending = this.pendingFetches.get(key);
		if (pending) pending.invalidated = true;
		this.pendingFetches.delete(key);
		this.memoryCache.delete(key);
		await this.redisClient.del(`kvcache:${this.name}:${key}`);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * This awaits the call to Redis to ensure that the write succeeded, which is important for a few reasons:
	 *   * Other code uses this to synchronize changes between worker processes. A failed write can internally de-sync the cluster.
	 *   * Without an `await`, consecutive calls could race. An unlucky race could result in the older write overwriting the newer value.
	 *   * Not awaiting here makes the entire cache non-consistent. The prevents many possible uses.
	 */
	@bindThis
	public async fetch(key: string): Promise<T> {
		// Keep the zero-I/O memory hit path free of Promise/Redis work.
		const memoryCached = this.memoryCache.get(key);
		if (memoryCached !== undefined) return memoryCached;

		// Coalesce concurrent misses for the same key. Without this, a burst of
		// requests can duplicate the same Redis read and DB fetch many times.
		const pending = this.pendingFetches.get(key);
		if (pending) return pending.promise;

		const entry: { promise: Promise<T>; invalidated: boolean } = { promise: null as unknown as Promise<T>, invalidated: false };
		entry.promise = (async () => {
			const cachedValue = await this.get(key);
			if (entry.invalidated) this.memoryCache.delete(key);
			if (cachedValue !== undefined) return cachedValue;

			const value = await this.fetcher(key);
			if (!entry.invalidated) await this.set(key, value);
			return value;
		})().finally(() => {
			if (this.pendingFetches.get(key) === entry) this.pendingFetches.delete(key);
		});

		this.pendingFetches.set(key, entry);
		return entry.promise;
	}

	@bindThis
	public async refresh(key: string) {
		const value = await this.fetcher(key);
		await this.set(key, value);

		// TODO: イベント発行して他プロセスのメモリキャッシュも更新できるようにする
	}

	@bindThis
	public gc() {
		this.memoryCache.gc();
	}

	@bindThis
	public dispose() {
		for (const pending of this.pendingFetches.values()) pending.invalidated = true;
		this.pendingFetches.clear();
		this.memoryCache.dispose();
	}
}

export class RedisSingleCache<T> {
	private readonly lifetime: number;
	private readonly memoryCache: MemorySingleCache<T>;
	private readonly fetcher: () => Promise<T>;
	private pendingFetch: { promise: Promise<T>; invalidated: boolean } | null = null;
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;

	constructor(
		private redisClient: Redis.Redis,
		private name: string,
		opts: {
			lifetime: number;
			memoryCacheLifetime: number;
			fetcher: RedisSingleCache<T>['fetcher'];
			toRedisConverter: RedisSingleCache<T>['toRedisConverter'];
			fromRedisConverter: RedisSingleCache<T>['fromRedisConverter'];
		},
	) {
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemorySingleCache(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
	}

	@bindThis
	public async set(value: T): Promise<void> {
		this.memoryCache.set(value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(
				`singlecache:${this.name}`,
				this.toRedisConverter(value),
			);
		} else {
			await this.redisClient.set(
				`singlecache:${this.name}`,
				this.toRedisConverter(value),
				'EX', Math.round(this.lifetime / 1000),
			);
		}
	}

	@bindThis
	public async get(): Promise<T | undefined> {
		const memoryCached = this.memoryCache.get();
		if (memoryCached !== undefined) return memoryCached;

		const cached = await this.redisClient.get(`singlecache:${this.name}`);
		if (cached == null) return undefined;

		const value = this.fromRedisConverter(cached);
		if (value !== undefined) {
			this.memoryCache.set(value);
		}

		return value;
	}

	@bindThis
	public async delete(): Promise<void> {
		if (this.pendingFetch) this.pendingFetch.invalidated = true;
		this.pendingFetch = null;
		this.memoryCache.delete();
		await this.redisClient.del(`singlecache:${this.name}`);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * This awaits the call to Redis to ensure that the write succeeded, which is important for a few reasons:
	 *   * Other code uses this to synchronize changes between worker processes. A failed write can internally de-sync the cluster.
	 *   * Without an `await`, consecutive calls could race. An unlucky race could result in the older write overwriting the newer value.
	 *   * Not awaiting here makes the entire cache non-consistent. The prevents many possible uses.
	 */
	@bindThis
	public async fetch(): Promise<T> {
		const memoryCached = this.memoryCache.get();
		if (memoryCached !== undefined) return memoryCached;
		if (this.pendingFetch) return this.pendingFetch.promise;

		const entry: { promise: Promise<T>; invalidated: boolean } = { promise: null as unknown as Promise<T>, invalidated: false };
		entry.promise = (async () => {
			const cachedValue = await this.get();
			if (entry.invalidated) this.memoryCache.delete();
			if (cachedValue !== undefined) return cachedValue;

			const value = await this.fetcher();
			if (!entry.invalidated) await this.set(value);
			return value;
		})().finally(() => {
			if (this.pendingFetch === entry) this.pendingFetch = null;
		});

		this.pendingFetch = entry;
		return entry.promise;
	}

	@bindThis
	public async refresh() {
		const value = await this.fetcher();
		await this.set(value);

		// TODO: イベント発行して他プロセスのメモリキャッシュも更新できるようにする
	}
}

export class MemoryKVCache<T> {
	private readonly cache = new Map<string, { date: number; value: T; }>();
	private readonly pendingFetches = new Map<string, { promise: Promise<T>; invalidated: boolean }>();
	private readonly pendingMaybeFetches = new Map<string, { promise: Promise<T | undefined>; invalidated: boolean }>();

	constructor(
		private readonly lifetime: number,
		private readonly limit: number = DEFAULT_MEMORY_KV_CACHE_LIMIT,
	) {
		registerMemoryKvCache(this);
	}

	@bindThis
	/**
	 * Mapにキャッシュをセットします
	 * @deprecated これを直接呼び出すべきではない。InternalEventなどで変更を全てのプロセス/マシンに通知するべき
	 */
	public set(key: string, value: T): void {
		if (this.limit <= 0) {
			throw new Error('Limit must be greater than 0');
		}

		if (this.limit !== Infinity) {
			this.gc();

			// 挿入順を更新して LRU を保つため、同一キーは一度削除する
			this.cache.delete(key);

			while (this.cache.size >= this.limit) {
				const oldestKey = this.cache.keys().next().value;
				if (oldestKey == null) {
					throw new Error('Cache is empty but size exceeds the limit');
				}
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			date: Date.now(),
			value,
		});
	}

	@bindThis
	public get(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached == null) return undefined;
		if ((Date.now() - cached.date) > this.lifetime) {
			this.cache.delete(key);
			return undefined;
		}
		if (this.limit !== Infinity) {
			// access 順を更新して LRU を保つ
			this.cache.delete(key);
			this.cache.set(key, cached);
		}
		return cached.value;
	}

	@bindThis
	public delete(key: string): void {
		const pending = this.pendingFetches.get(key);
		if (pending) pending.invalidated = true;
		this.pendingFetches.delete(key);
		const pendingMaybe = this.pendingMaybeFetches.get(key);
		if (pendingMaybe) pendingMaybe.invalidated = true;
		this.pendingMaybeFetches.delete(key);
		this.cache.delete(key);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	@bindThis
	public async fetch(key: string, fetcher: () => Promise<T>, validator?: (cachedValue: T) => boolean): Promise<T> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator ? validator(cachedValue) : true) return cachedValue;
		}

		// A validator can intentionally make the same key use a different fetch path,
		// so only the normal cache-miss path is coalesced.
		if (validator == null) {
			const pending = this.pendingFetches.get(key);
			if (pending) return pending.promise;
			const entry: { promise: Promise<T>; invalidated: boolean } = { promise: null as unknown as Promise<T>, invalidated: false };
			entry.promise = fetcher().then(value => {
				if (!entry.invalidated) this.set(key, value);
				return value;
			}).finally(() => {
				if (this.pendingFetches.get(key) === entry) this.pendingFetches.delete(key);
			});
			this.pendingFetches.set(key, entry);
			return entry.promise;
		}

		const value = await fetcher();
		this.set(key, value);
		return value;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	@bindThis
	public async fetchMaybe(key: string, fetcher: () => Promise<T | undefined>, validator?: (cachedValue: T) => boolean): Promise<T | undefined> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator ? validator(cachedValue) : true) return cachedValue;
		}

		if (validator == null) {
			const pending = this.pendingMaybeFetches.get(key);
			if (pending) return pending.promise;
			const entry: { promise: Promise<T | undefined>; invalidated: boolean } = { promise: null as unknown as Promise<T | undefined>, invalidated: false };
			entry.promise = fetcher().then(value => {
				if (!entry.invalidated && value !== undefined) this.set(key, value);
				return value;
			}).finally(() => {
				if (this.pendingMaybeFetches.get(key) === entry) this.pendingMaybeFetches.delete(key);
			});
			this.pendingMaybeFetches.set(key, entry);
			return entry.promise;
		}

		const value = await fetcher();
		if (value !== undefined) this.set(key, value);
		return value;
	}

	@bindThis
	public gc(): void {
		const now = Date.now();

		for (const [key, { date }] of this.cache.entries()) {
			const age = now - date;
			if (age >= this.lifetime) this.cache.delete(key);
		}
	}

	@bindThis
	public dispose(): void {
		for (const pending of this.pendingFetches.values()) pending.invalidated = true;
		for (const pending of this.pendingMaybeFetches.values()) pending.invalidated = true;
		this.pendingFetches.clear();
		this.pendingMaybeFetches.clear();
		unregisterMemoryKvCache(this);
	}

	public get entries() {
		return this.cache.entries();
	}
}

export class MemorySingleCache<T> {
	private cachedAt: number | null = null;
	private value: T | undefined;
	private pendingFetch: { promise: Promise<T>; invalidated: boolean } | null = null;
	private pendingMaybeFetch: { promise: Promise<T | undefined>; invalidated: boolean } | null = null;

	constructor(
		private lifetime: number,
	) {}

	@bindThis
	public set(value: T): void {
		this.cachedAt = Date.now();
		this.value = value;
	}

	@bindThis
	public get(): T | undefined {
		if (this.cachedAt == null) return undefined;
		if ((Date.now() - this.cachedAt) > this.lifetime) {
			this.value = undefined;
			this.cachedAt = null;
			return undefined;
		}
		return this.value;
	}

	@bindThis
	public delete() {
		if (this.pendingFetch) this.pendingFetch.invalidated = true;
		if (this.pendingMaybeFetch) this.pendingMaybeFetch.invalidated = true;
		this.pendingFetch = null;
		this.pendingMaybeFetch = null;
		this.value = undefined;
		this.cachedAt = null;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	@bindThis
	public async fetch(fetcher: () => Promise<T>, validator?: (cachedValue: T) => boolean): Promise<T> {
		const cachedValue = this.get();
		if (cachedValue !== undefined) {
			if (validator ? validator(cachedValue) : true) return cachedValue;
		}

		if (validator == null) {
			if (this.pendingFetch) return this.pendingFetch.promise;
			const entry: { promise: Promise<T>; invalidated: boolean } = { promise: null as unknown as Promise<T>, invalidated: false };
			entry.promise = fetcher().then(value => {
				if (!entry.invalidated) this.set(value);
				return value;
			}).finally(() => {
				if (this.pendingFetch === entry) this.pendingFetch = null;
			});
			this.pendingFetch = entry;
			return entry.promise;
		}

		const value = await fetcher();
		this.set(value);
		return value;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	@bindThis
	public async fetchMaybe(fetcher: () => Promise<T | undefined>, validator?: (cachedValue: T) => boolean): Promise<T | undefined> {
		const cachedValue = this.get();
		if (cachedValue !== undefined) {
			if (validator ? validator(cachedValue) : true) return cachedValue;
		}

		if (validator == null) {
			if (this.pendingMaybeFetch) return this.pendingMaybeFetch.promise;
			const entry: { promise: Promise<T | undefined>; invalidated: boolean } = { promise: null as unknown as Promise<T | undefined>, invalidated: false };
			entry.promise = fetcher().then(value => {
				if (!entry.invalidated && value !== undefined) this.set(value);
				return value;
			}).finally(() => {
				if (this.pendingMaybeFetch === entry) this.pendingMaybeFetch = null;
			});
			this.pendingMaybeFetch = entry;
			return entry.promise;
		}

		const value = await fetcher();
		if (value !== undefined) this.set(value);
		return value;
	}
}
