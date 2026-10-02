/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { MotionScheduler } from '@/motion/core/scheduler.js';
import type { MotionClock } from '@/motion/core/clock.js';

class FakeClock implements MotionClock {
	private nextHandle = 1;
	private callbacks = new Map<number, FrameRequestCallback>();
	public cancelled: number[] = [];

	public now(): number {
		return 0;
	}

	public requestFrame(callback: FrameRequestCallback): number {
		const handle = this.nextHandle++;
		this.callbacks.set(handle, callback);
		return handle;
	}

	public cancelFrame(handle: number): void {
		this.cancelled.push(handle);
		this.callbacks.delete(handle);
	}

	public flush(timestamp = 16): void {
		const callbacks = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of callbacks) callback(timestamp);
	}

	public get pendingFrames(): number {
		return this.callbacks.size;
	}
}

describe('MotionScheduler', () => {
	test('batches reads before writes in one frame', () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const order: string[] = [];
		scheduler.scheduleWrite(() => order.push('write'));
		scheduler.scheduleRead(() => order.push('read'));
		expect(clock.pendingFrames).toBe(1);
		clock.flush();
		expect(order).toEqual(['read', 'write']);
		expect(scheduler.active).toBe(false);
	});

	test('runs a write scheduled by a read in the same frame', () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const order: string[] = [];
		scheduler.scheduleRead(() => {
			order.push('read');
			scheduler.scheduleWrite(() => order.push('write'));
		});
		clock.flush();
		expect(order).toEqual(['read', 'write']);
		expect(clock.pendingFrames).toBe(0);
	});

	test('cancels the pending frame when the last scheduled task is removed', () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const cancel = scheduler.scheduleRead(() => {});
		cancel();
		expect(clock.pendingFrames).toBe(0);
		expect(scheduler.active).toBe(false);
	});
});
