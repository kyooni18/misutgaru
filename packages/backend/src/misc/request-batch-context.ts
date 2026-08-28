/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

type BatchStore = Map<string, unknown>;

class RequestBatchContext {
	private readonly storage = new AsyncLocalStorage<BatchStore>();

	public run<T>(callback: () => T): T {
		return this.storage.run(new Map(), callback);
	}

	public getOrCreate<T>(key: string, create: () => T, fallback: T): T {
		const store = this.storage.getStore();
		if (!store) return fallback;
		const existing = store.get(key) as T | undefined;
		if (existing !== undefined) return existing;
		const value = create();
		store.set(key, value);
		runtimeDiagnostics.increment('batchGraph.loaderCreated');
		return value;
	}

	public active(): boolean {
		return this.storage.getStore() !== undefined;
	}
}

export const requestBatchContext = new RequestBatchContext();
