/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';

/**
 * Small TTL cache for frontend control-plane data.
 *
 * Concurrent misses share one fetch. A set/delete performed while that fetch is
 * in flight advances the generation, so the late result cannot resurrect stale
 * data or overwrite a newer explicit value.
 */
export class Cache<T> {
	private cachedAt: number | null = null;
	public value = ref<T | undefined>();
	private readonly lifetime: number;
	private readonly fetcher: () => Promise<T>;
	private generation = 0;
	private pending: { generation: number; promise: Promise<T> } | null = null;

	constructor(lifetime: Cache<never>['lifetime'], fetcher: () => Promise<T>) {
		this.lifetime = lifetime;
		this.fetcher = fetcher;
	}

	public set(value: T): void {
		this.generation += 1;
		this.cachedAt = Date.now();
		this.value.value = value;
	}

	private get(): T | undefined {
		if (this.cachedAt == null) return undefined;
		if ((Date.now() - this.cachedAt) > this.lifetime) {
			this.value.value = undefined;
			this.cachedAt = null;
			this.generation += 1;
			return undefined;
		}
		return this.value.value;
	}

	public delete(): void {
		this.generation += 1;
		this.cachedAt = null;
		this.value.value = undefined;
	}

	/**
	 * Return the cached value or coalesce one fetch for the current generation.
	 * If an explicit mutation wins during the fetch, resolve to that authoritative
	 * value when one exists instead of publishing the stale fetch result.
	 */
	public async fetch(): Promise<T> {
		const cachedValue = this.get();
		if (cachedValue !== undefined) return cachedValue;

		const generation = this.generation;
		if (this.pending?.generation === generation) return this.pending.promise;

		const promise = (async () => {
			const value = await this.fetcher();
			if (this.generation === generation) {
				this.cachedAt = Date.now();
				this.value.value = value;
				return value;
			}

			const authoritative = this.get();
			if (authoritative !== undefined) return authoritative;
			// delete/expiry won while the old request was in flight. Do not return
			// that stale response to the caller; fetch for the new generation instead.
			return this.fetch();
		})();
		this.pending = { generation, promise };
		try {
			return await promise;
		} finally {
			if (this.pending?.promise === promise) this.pending = null;
		}
	}
}
