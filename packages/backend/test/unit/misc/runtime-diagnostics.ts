/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { measuredDiagnostic, runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

describe('runtime diagnostics', () => {
	beforeEach(() => runtimeDiagnostics.reset());

	test('collects bounded counters, distributions, and traces in process memory', async () => {
		runtimeDiagnostics.increment('example.count', 2);
		runtimeDiagnostics.observe('example.size', 2);
		runtimeDiagnostics.observe('example.size', 6);
		runtimeDiagnostics.trace('example.slow', 12, { scope: 'test' });

		const snapshot = runtimeDiagnostics.snapshot();
		expect(snapshot.counters['example.count']).toBe(2);
		expect(snapshot.distributions['example.size']).toMatchObject({
			count: 2,
			sum: 8,
			min: 2,
			max: 6,
			average: 4,
			p50: 2,
			p95: 6,
			p99: 6,
		});
		expect(snapshot.recentTraces.at(-1)).toMatchObject({
			category: 'example.slow',
			durationMs: 12,
			detail: { scope: 'test' },
		});
		expect(snapshot.process.eventLoopDelay).toEqual(expect.objectContaining({
			p50Ms: expect.any(Number),
			p95Ms: expect.any(Number),
			p99Ms: expect.any(Number),
			maxMs: expect.any(Number),
		}));
	});

	test('measuredDiagnostic records duration even when the operation throws', async () => {
		await expect(measuredDiagnostic('example.duration', async () => {
			throw new Error('boom');
		}, 0, { scope: 'throwing-operation' })).rejects.toThrow('boom');

		const snapshot = runtimeDiagnostics.snapshot();
		expect(snapshot.distributions['example.duration']?.count).toBe(1);
		expect(snapshot.recentTraces.some(trace => trace.category === 'example.duration')).toBe(true);
	});
});
