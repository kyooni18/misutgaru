/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { requestBatchContext } from '@/misc/request-batch-context.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

describe('request batch context', () => {
	beforeEach(() => runtimeDiagnostics.reset());

	test('reuses a loader inside one request and isolates parallel requests', async () => {
		const create = vi.fn(() => ({ token: Symbol('loader') }));
		const fallback = { token: Symbol('fallback') };

		const first = requestBatchContext.run(async () => {
			const a = requestBatchContext.getOrCreate('loader', create, fallback);
			await Promise.resolve();
			const b = requestBatchContext.getOrCreate('loader', create, fallback);
			expect(a).toBe(b);
			return a;
		});
		const second = requestBatchContext.run(async () => requestBatchContext.getOrCreate('loader', create, fallback));

		const [a, b] = await Promise.all([first, second]);
		expect(a).not.toBe(b);
		expect(create).toHaveBeenCalledTimes(2);
		expect(runtimeDiagnostics.snapshot().counters['batchGraph.loaderCreated']).toBe(2);
	});

	test('uses the supplied fallback outside an API request context', () => {
		const create = vi.fn(() => ({ token: Symbol('loader') }));
		const fallback = { token: Symbol('fallback') };
		expect(requestBatchContext.active()).toBe(false);
		expect(requestBatchContext.getOrCreate('loader', create, fallback)).toBe(fallback);
		expect(create).not.toHaveBeenCalled();
	});
});
