/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

export type FetchFunction<K, V> = (key: K) => Promise<V>;

type ResolveReject<V> = Parameters<ConstructorParameters<typeof Promise<V>>[0]>;

type ResolverPair<V> = {
	resolve: ResolveReject<V>[0];
	reject: ResolveReject<V>[1];
};

export class DebounceLoader<K, V> {
	private resolverMap = new Map<K, ResolverPair<V>>();
	private promiseMap = new Map<K, Promise<V>>();
	private resolvedPromise = Promise.resolve();
	constructor(private loadFn: FetchFunction<K, V>) {}

	public load(key: K): Promise<V> {
		const promise = this.promiseMap.get(key);
		if (typeof promise !== 'undefined') {
			return promise;
		}

		const isFirst = this.promiseMap.size === 0;
		const newPromise = new Promise<V>((resolve, reject) => {
			this.resolverMap.set(key, { resolve, reject });
		});
		this.promiseMap.set(key, newPromise);

		if (isFirst) {
			this.enqueueDebouncedLoadJob();
		}

		return newPromise;
	}

	private runDebouncedLoad(): void {
		const resolvers = [...this.resolverMap];
		this.resolverMap.clear();
		this.promiseMap.clear();

		for (const [key, { resolve, reject }] of resolvers) {
			this.loadFn(key).then(resolve, reject);
		}
	}

	private enqueueDebouncedLoadJob(): void {
		this.resolvedPromise.then(() => {
			process.nextTick(() => {
				this.runDebouncedLoad();
			});
		});
	}
}

export type BatchFetchFunction<K, V> = (keys: readonly K[]) => Promise<ReadonlyMap<K, V>>;

/**
 * DataLoader-style batcher for repository/entity hot paths. Distinct keys in
 * the same microtask share one repository batch and duplicate keys share the
 * same promise even while that batch is in flight. Process-long loaders drop
 * settled promises for freshness; request-scoped instances may retain them for
 * the lifetime of the surrounding AsyncLocalStorage request context.
 */
export class BatchLoader<K, V> {
	private resolverMap = new Map<K, ResolverPair<V>>();
	private promiseMap = new Map<K, Promise<V>>();
	private scheduled = false;

	constructor(
		private loadManyFn: BatchFetchFunction<K, V>,
		private missing: (key: K) => unknown = key => new Error(`BatchLoader did not return key: ${String(key)}`),
		private label?: string,
		private cacheSettled = false,
	) {}

	public load(key: K): Promise<V> {
		const existing = this.promiseMap.get(key);
		if (existing) return existing;
		const promise = new Promise<V>((resolve, reject) => {
			this.resolverMap.set(key, { resolve, reject });
		});
		this.promiseMap.set(key, promise);
		this.enqueue();
		return promise;
	}

	public loadMany(keys: readonly K[]): Promise<V[]> {
		return Promise.all(keys.map(key => this.load(key)));
	}

	private enqueue(): void {
		if (this.scheduled) return;
		this.scheduled = true;
		queueMicrotask(() => void this.flush());
	}

	private async flush(): Promise<void> {
		this.scheduled = false;
		const resolvers = this.resolverMap;
		this.resolverMap = new Map();
		if (resolvers.size === 0) return;
		const keys = [...resolvers.keys()];
		runtimeDiagnostics.increment('batchLoader.flushes');
		runtimeDiagnostics.observe('batchLoader.batchSize', keys.length);
		if (this.label) {
			runtimeDiagnostics.increment(`batchLoader.${this.label}.flushes`);
			runtimeDiagnostics.observe(`batchLoader.${this.label}.batchSize`, keys.length);
		}
		const startedAt = performance.now();
		let values: ReadonlyMap<K, V>;
		try {
			values = await this.loadManyFn(keys);
		} catch (error) {
			runtimeDiagnostics.increment('batchLoader.errors');
			if (this.label) runtimeDiagnostics.increment(`batchLoader.${this.label}.errors`);
			for (const [key, { reject }] of resolvers) {
				if (!this.cacheSettled) this.promiseMap.delete(key);
				reject(error);
			}
			return;
		} finally {
			const durationMs = performance.now() - startedAt;
			runtimeDiagnostics.observe('batchLoader.durationMs', durationMs);
			if (this.label) runtimeDiagnostics.observe(`batchLoader.${this.label}.durationMs`, durationMs);
			if (durationMs >= 50) runtimeDiagnostics.trace('batchLoader.slow', durationMs, { batchSize: keys.length, ...(this.label ? { loader: this.label } : {}) });
		}
		for (const [key, { resolve, reject }] of resolvers) {
			if (!this.cacheSettled) this.promiseMap.delete(key);
			if (values.has(key)) resolve(values.get(key)!);
			else reject(this.missing(key));
		}
	}
}
