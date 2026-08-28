/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Redis from 'ioredis';
import { bindThis } from '@/decorators.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

type GcTarget = { gc(): void };
type PendingRedisFetch<T> = {
	promise: Promise<T>;
	invalidated: boolean;
	writePromise: Promise<void> | null;
};

export interface CacheInvalidationBus {
	register(cacheName: string, listener: (key: string | null) => void): () => void;
	publish(cacheName: string, key: string | null): Promise<void>;
}
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
	private readonly pendingFetches = new Map<string, PendingRedisFetch<T>>();
	private readonly activeMutations = new Map<string, Promise<void>>();
	private readonly generations = new Map<string, number>();
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;
	private readonly invalidationBus?: CacheInvalidationBus;
	private readonly unsubscribeInvalidation?: () => void;

	constructor(
		private redisClient: Redis.Redis,
		private name: string,
		opts: {
			lifetime: RedisKVCache<T>['lifetime'];
			memoryCacheLifetime: number;
			fetcher: RedisKVCache<T>['fetcher'];
			toRedisConverter: RedisKVCache<T>['toRedisConverter'];
			fromRedisConverter: RedisKVCache<T>['fromRedisConverter'];
			invalidationBus?: CacheInvalidationBus;
		},
	) {
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemoryKVCache(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
		this.invalidationBus = opts.invalidationBus;
		this.unsubscribeInvalidation = opts.invalidationBus?.register(this.name, key => {
			if (key == null) return;
			this.invalidatePending(key);
			this.memoryCache.delete(key);
		});
	}

	private generation(key: string): number {
		return this.generations.get(key) ?? 0;
	}

	private invalidatePending(key: string): PendingRedisFetch<T> | undefined {
		this.generations.set(key, this.generation(key) + 1);
		const pending = this.pendingFetches.get(key);
		if (pending) pending.invalidated = true;
		this.pendingFetches.delete(key);
		return pending;
	}

	/**
	 * Serialize explicit writes for a key and only wait for the write portion of
	 * an invalidated cache fill. Waiting for the whole fetch promise here would
	 * deadlock because an invalidated fetch intentionally waits for this mutation
	 * before it retries.
	 */
	private mutate(key: string, operation: () => Promise<void>): Promise<void> {
		const pending = this.invalidatePending(key);
		// Once an explicit mutation starts, the previous memory snapshot is no
		// longer authoritative. Dropping it here prevents the zero-I/O fetch fast
		// path from returning the old value while the Redis write/delete is still
		// in flight.
		this.memoryCache.delete(key);
		const previous = this.activeMutations.get(key);
		const mutation = (async () => {
			if (previous) await previous.catch(() => undefined);
			if (pending?.writePromise) await pending.writePromise.catch(() => undefined);
			await operation();
		})();
		this.activeMutations.set(key, mutation);
		void mutation.finally(() => {
			if (this.activeMutations.get(key) === mutation) this.activeMutations.delete(key);
		}).catch(() => undefined);
		return mutation;
	}

	private async refetchAfterMutation(key: string): Promise<T> {
		const mutation = this.activeMutations.get(key);
		if (mutation) await mutation.catch(() => undefined);
		return this.fetch(key);
	}

	@bindThis
	public set(key: string, value: T): Promise<void> {
		return this.mutate(key, () => this.write(key, value));
	}

	private async write(key: string, value: T): Promise<void> {
		const generation = this.generation(key);
		const encoded = this.toRedisConverter(value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(`kvcache:${this.name}:${key}`, encoded);
		} else {
			await this.redisClient.set(`kvcache:${this.name}:${key}`, encoded, 'EX', Math.round(this.lifetime / 1000));
		}
		// A remote invalidation may arrive while the Redis write is awaiting. In
		// that case do not resurrect this process's pre-invalidation snapshot after
		// the event handler has already cleared it. With no intervening generation
		// change, setting memory is safe; a later remote event will invalidate it.
		if (generation === this.generation(key)) this.memoryCache.set(key, value);
		await this.invalidationBus?.publish(this.name, key);
	}

	@bindThis
	public async get(key: string): Promise<T | undefined> {
		for (;;) {
			const mutation = this.activeMutations.get(key);
			if (mutation) await mutation.catch(() => undefined);
			const generation = this.generation(key);
			const memoryCached = this.memoryCache.get(key);
			if (memoryCached !== undefined) {
				runtimeDiagnostics.increment('cache.kv.memoryHit');
				return memoryCached;
			}

			const cached = await this.redisClient.get(`kvcache:${this.name}:${key}`);
			if (generation !== this.generation(key)) {
				runtimeDiagnostics.increment('cache.kv.staleRetry');
				continue;
			}
			if (cached == null) {
				runtimeDiagnostics.increment('cache.kv.redisMiss');
				return undefined;
			}

			const value = this.fromRedisConverter(cached);
			if (generation !== this.generation(key)) {
				runtimeDiagnostics.increment('cache.kv.staleRetry');
				continue;
			}
			if (value !== undefined) {
				runtimeDiagnostics.increment('cache.kv.redisHit');
				this.memoryCache.set(key, value);
			}
			return value;
		}
	}

	@bindThis
	public delete(key: string): Promise<void> {
		return this.mutate(key, async () => {
			await this.redisClient.del(`kvcache:${this.name}:${key}`);
			this.memoryCache.delete(key);
			await this.invalidationBus?.publish(this.name, key);
		});
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
		if (memoryCached !== undefined) {
			runtimeDiagnostics.increment('cache.kv.memoryHit');
			return memoryCached;
		}

		// Coalesce concurrent misses for the same key. Without this, a burst of
		// requests can duplicate the same Redis read and DB fetch many times.
		const pending = this.pendingFetches.get(key);
		if (pending) {
			runtimeDiagnostics.increment('cache.kv.coalesced');
			return pending.promise;
		}

		const entry: PendingRedisFetch<T> = {
			promise: null as unknown as Promise<T>,
			invalidated: false,
			writePromise: null,
		};
		entry.promise = (async () => {
			const cachedValue = await this.get(key);
			if (entry.invalidated) {
				// get() may have populated memory with a Redis value that lost a race
				// with set/delete. Do not let the retry observe that stale snapshot.
				this.memoryCache.delete(key);
				return this.refetchAfterMutation(key);
			}
			if (cachedValue !== undefined) return cachedValue;

			runtimeDiagnostics.increment('cache.kv.fetcher');
			const fetchStartedAt = performance.now();
			const value = await this.fetcher(key);
			const fetchDuration = performance.now() - fetchStartedAt;
			runtimeDiagnostics.observe('cache.kv.fetcherDurationMs', fetchDuration);
			if (fetchDuration >= 100) runtimeDiagnostics.trace('cache.kv.slowFetcher', fetchDuration, { cache: this.name });
			if (entry.invalidated) return this.refetchAfterMutation(key);

			entry.writePromise = this.write(key, value);
			try {
				await entry.writePromise;
			} catch (error) {
				// If a newer explicit mutation superseded this fill while its Redis
				// write was failing, return the authoritative post-mutation value.
				// Without invalidation, preserve the historical write failure.
				if (entry.invalidated) return this.refetchAfterMutation(key);
				throw error;
			}
			if (entry.invalidated) return this.refetchAfterMutation(key);
			return value;
		})().finally(() => {
			if (this.pendingFetches.get(key) === entry) this.pendingFetches.delete(key);
		});

		this.pendingFetches.set(key, entry);
		return entry.promise;
	}

	@bindThis
	public refresh(key: string): Promise<void> {
		return this.mutate(key, async () => {
			const value = await this.fetcher(key);
			await this.write(key, value);
		});
	}

	@bindThis
	public gc() {
		this.memoryCache.gc();
	}

	@bindThis
	public dispose() {
		this.unsubscribeInvalidation?.();
		for (const pending of this.pendingFetches.values()) pending.invalidated = true;
		this.pendingFetches.clear();
		this.activeMutations.clear();
		this.generations.clear();
		this.memoryCache.dispose();
	}
}

export class RedisSingleCache<T> {
	private readonly lifetime: number;
	private readonly memoryCache: MemorySingleCache<T>;
	private readonly fetcher: () => Promise<T>;
	private pendingFetch: PendingRedisFetch<T> | null = null;
	private activeMutation: Promise<void> | null = null;
	private generation = 0;
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;
	private readonly invalidationBus?: CacheInvalidationBus;
	private readonly unsubscribeInvalidation?: () => void;

	constructor(
		private redisClient: Redis.Redis,
		private name: string,
		opts: {
			lifetime: number;
			memoryCacheLifetime: number;
			fetcher: RedisSingleCache<T>['fetcher'];
			toRedisConverter: RedisSingleCache<T>['toRedisConverter'];
			fromRedisConverter: RedisSingleCache<T>['fromRedisConverter'];
			invalidationBus?: CacheInvalidationBus;
		},
	) {
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemorySingleCache(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
		this.invalidationBus = opts.invalidationBus;
		this.unsubscribeInvalidation = opts.invalidationBus?.register(this.name, key => {
			if (key !== null) return;
			this.invalidatePending();
			this.memoryCache.delete();
		});
	}

	private invalidatePending(): PendingRedisFetch<T> | null {
		this.generation += 1;
		const pending = this.pendingFetch;
		if (pending) pending.invalidated = true;
		this.pendingFetch = null;
		return pending;
	}

	private mutate(operation: () => Promise<void>): Promise<void> {
		const pending = this.invalidatePending();
		this.memoryCache.delete();
		const previous = this.activeMutation;
		const mutation = (async () => {
			if (previous) await previous.catch(() => undefined);
			if (pending?.writePromise) await pending.writePromise.catch(() => undefined);
			await operation();
		})();
		this.activeMutation = mutation;
		void mutation.finally(() => {
			if (this.activeMutation === mutation) this.activeMutation = null;
		}).catch(() => undefined);
		return mutation;
	}

	private async refetchAfterMutation(): Promise<T> {
		const mutation = this.activeMutation;
		if (mutation) await mutation.catch(() => undefined);
		return this.fetch();
	}

	@bindThis
	public set(value: T): Promise<void> {
		return this.mutate(() => this.write(value));
	}

	private async write(value: T): Promise<void> {
		const generation = this.generation;
		const encoded = this.toRedisConverter(value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(`singlecache:${this.name}`, encoded);
		} else {
			await this.redisClient.set(`singlecache:${this.name}`, encoded, 'EX', Math.round(this.lifetime / 1000));
		}
		if (generation === this.generation) this.memoryCache.set(value);
		await this.invalidationBus?.publish(this.name, null);
	}

	@bindThis
	public async get(): Promise<T | undefined> {
		for (;;) {
			const mutation = this.activeMutation;
			if (mutation) await mutation.catch(() => undefined);
			const generation = this.generation;
			const memoryCached = this.memoryCache.get();
			if (memoryCached !== undefined) {
				runtimeDiagnostics.increment('cache.single.memoryHit');
				return memoryCached;
			}

			const cached = await this.redisClient.get(`singlecache:${this.name}`);
			if (generation !== this.generation) {
				runtimeDiagnostics.increment('cache.single.staleRetry');
				continue;
			}
			if (cached == null) {
				runtimeDiagnostics.increment('cache.single.redisMiss');
				return undefined;
			}

			const value = this.fromRedisConverter(cached);
			if (generation !== this.generation) {
				runtimeDiagnostics.increment('cache.single.staleRetry');
				continue;
			}
			if (value !== undefined) {
				runtimeDiagnostics.increment('cache.single.redisHit');
				this.memoryCache.set(value);
			}
			return value;
		}
	}

	@bindThis
	public delete(): Promise<void> {
		return this.mutate(async () => {
			await this.redisClient.del(`singlecache:${this.name}`);
			this.memoryCache.delete();
			await this.invalidationBus?.publish(this.name, null);
		});
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
		if (memoryCached !== undefined) {
			runtimeDiagnostics.increment('cache.single.memoryHit');
			return memoryCached;
		}
		if (this.pendingFetch) {
			runtimeDiagnostics.increment('cache.single.coalesced');
			return this.pendingFetch.promise;
		}

		const entry: PendingRedisFetch<T> = {
			promise: null as unknown as Promise<T>,
			invalidated: false,
			writePromise: null,
		};
		entry.promise = (async () => {
			const cachedValue = await this.get();
			if (entry.invalidated) {
				this.memoryCache.delete();
				return this.refetchAfterMutation();
			}
			if (cachedValue !== undefined) return cachedValue;

			runtimeDiagnostics.increment('cache.single.fetcher');
			const fetchStartedAt = performance.now();
			const value = await this.fetcher();
			const fetchDuration = performance.now() - fetchStartedAt;
			runtimeDiagnostics.observe('cache.single.fetcherDurationMs', fetchDuration);
			if (fetchDuration >= 100) runtimeDiagnostics.trace('cache.single.slowFetcher', fetchDuration, { cache: this.name });
			if (entry.invalidated) return this.refetchAfterMutation();

			entry.writePromise = this.write(value);
			try {
				await entry.writePromise;
			} catch (error) {
				if (entry.invalidated) return this.refetchAfterMutation();
				throw error;
			}
			if (entry.invalidated) return this.refetchAfterMutation();
			return value;
		})().finally(() => {
			if (this.pendingFetch === entry) this.pendingFetch = null;
		});

		this.pendingFetch = entry;
		return entry.promise;
	}

	@bindThis
	public refresh(): Promise<void> {
		return this.mutate(async () => {
			const value = await this.fetcher();
			await this.write(value);
		});
	}

	@bindThis
	public dispose() {
		this.unsubscribeInvalidation?.();
		if (this.pendingFetch) this.pendingFetch.invalidated = true;
		this.pendingFetch = null;
		this.activeMutation = null;
		this.memoryCache.dispose();
	}
}

export class MemoryKVCache<T> {
	private readonly cache = new Map<string, { date: number; value: T; }>();
	private readonly pendingFetches = new Map<string, { promise: Promise<T>; invalidated: boolean }>();
	private readonly pendingMaybeFetches = new Map<string, { promise: Promise<T | undefined>; invalidated: boolean }>();

	constructor(
		private readonly lifetime: number,
		private readonly limit: number = Infinity,
	) {
		registerMemoryKvCache(this);
	}

	@bindThis
	/**
	 * Mapにキャッシュをセットします
	 * @deprecated これを直接呼び出すべきではない。InternalEventなどで変更を全てのプロセス/マシンに通知するべき
	 */
	public set(key: string, value: T): void {
		const pending = this.pendingFetches.get(key);
		if (pending) pending.invalidated = true;
		this.pendingFetches.delete(key);
		const pendingMaybe = this.pendingMaybeFetches.get(key);
		if (pendingMaybe) pendingMaybe.invalidated = true;
		this.pendingMaybeFetches.delete(key);

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
		return [...this.cache.entries()].values();
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
		if (this.pendingFetch) this.pendingFetch.invalidated = true;
		if (this.pendingMaybeFetch) this.pendingMaybeFetch.invalidated = true;
		this.pendingFetch = null;
		this.pendingMaybeFetch = null;
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

	@bindThis
	public dispose() {
		this.delete();
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
