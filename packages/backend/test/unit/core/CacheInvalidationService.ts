/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test, vi } from 'vitest';
import { CacheInvalidationService } from '@/core/CacheInvalidationService.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

describe('CacheInvalidationService', () => {
	test('routes only remote messages for the named cache', async () => {
		let messageHandler: ((channel: string, data: string) => void) | undefined;
		const pub = { publish: vi.fn().mockResolvedValue(1) };
		const dedicatedSub = {
			on: vi.fn((_event: string, handler: typeof messageHandler) => { messageHandler = handler; }),
			off: vi.fn(),
			subscribe: vi.fn().mockResolvedValue(1),
			unsubscribe: vi.fn().mockResolvedValue(1),
			disconnect: vi.fn(),
		};
		const sharedSub = {
			duplicate: vi.fn(() => dedicatedSub),
			on: vi.fn(),
		};
		const service = new CacheInvalidationService({ host: 'example.test' } as never, pub as never, sharedSub as never);
		expect(sharedSub.on).not.toHaveBeenCalled();
		expect(sharedSub.duplicate).toHaveBeenCalledOnce();
		const listener = vi.fn();
		service.register('users', listener);
		await service.publish('users', 'u1');
		expect(pub.publish).toHaveBeenCalledOnce();
		const [channel] = pub.publish.mock.calls[0];
		messageHandler?.(channel, JSON.stringify({ v: 1, origin: 'other-process', cache: 'users', key: 'u1' }));
		messageHandler?.(channel, JSON.stringify({ v: 1, origin: 'other-process', cache: 'other', key: 'u1' }));
		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith('u1');
		await service.dispose();
		expect(dedicatedSub.disconnect).toHaveBeenCalledOnce();
	});

	test('contains an initial subscribe failure and exposes it through process diagnostics', async () => {
		runtimeDiagnostics.reset();
		const error = new Error('redis unavailable');
		const dedicatedSub = {
			on: vi.fn(),
			off: vi.fn(),
			subscribe: vi.fn().mockRejectedValue(error),
			unsubscribe: vi.fn().mockResolvedValue(1),
			disconnect: vi.fn(),
		};
		const sharedSub = { duplicate: vi.fn(() => dedicatedSub) };
		const pub = { publish: vi.fn().mockResolvedValue(1) };
		const service = new CacheInvalidationService({ host: 'example.test' } as never, pub as never, sharedSub as never);
		await Promise.resolve();
		await Promise.resolve();
		const snapshot = runtimeDiagnostics.snapshot();
		expect(snapshot.counters['cache.invalidationSubscribeError']).toBe(1);
		expect(snapshot.recentTraces.at(-1)).toMatchObject({
			category: 'cache.invalidationSubscribeError',
			detail: { message: 'redis unavailable' },
		});
		await service.dispose();
	});
	test('retries an initial subscribe failure without duplicating the dedicated subscriber', async () => {
		vi.useFakeTimers();
		try {
			const dedicatedSub = {
				on: vi.fn(),
				off: vi.fn(),
				subscribe: vi.fn()
					.mockRejectedValueOnce(new Error('redis starting'))
					.mockResolvedValueOnce(1),
				unsubscribe: vi.fn().mockResolvedValue(1),
				disconnect: vi.fn(),
			};
			const sharedSub = { duplicate: vi.fn(() => dedicatedSub) };
			const pub = { publish: vi.fn().mockResolvedValue(1) };
			const service = new CacheInvalidationService({ host: 'example.test' } as never, pub as never, sharedSub as never);
			await Promise.resolve();
			await Promise.resolve();
			expect(dedicatedSub.subscribe).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(500);
			expect(dedicatedSub.subscribe).toHaveBeenCalledTimes(2);
			expect(sharedSub.duplicate).toHaveBeenCalledOnce();
			await service.dispose();
			expect(dedicatedSub.unsubscribe).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
	});

	test('cancels a pending subscribe retry during shutdown', async () => {
		vi.useFakeTimers();
		try {
			const dedicatedSub = {
				on: vi.fn(),
				off: vi.fn(),
				subscribe: vi.fn().mockRejectedValue(new Error('redis unavailable')),
				unsubscribe: vi.fn().mockResolvedValue(1),
				disconnect: vi.fn(),
			};
			const sharedSub = { duplicate: vi.fn(() => dedicatedSub) };
			const pub = { publish: vi.fn().mockResolvedValue(1) };
			const service = new CacheInvalidationService({ host: 'example.test' } as never, pub as never, sharedSub as never);
			await Promise.resolve();
			await Promise.resolve();
			await service.dispose();
			await vi.advanceTimersByTimeAsync(10_000);
			expect(dedicatedSub.subscribe).toHaveBeenCalledTimes(1);
			expect(dedicatedSub.disconnect).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
	});

});
