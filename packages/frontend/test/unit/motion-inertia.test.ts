/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { inertiaMotionValue } from '@/motion/core/inertia.js';
import { MotionValue } from '@/motion/core/motion-value.js';
import { motionPolicy } from '@/motion/core/policy.js';
import { MotionScheduler } from '@/motion/core/scheduler.js';
import type { MotionClock } from '@/motion/core/clock.js';

class FakeClock implements MotionClock {
	public time = 0;
	private nextHandle = 1;
	private callbacks = new Map<number, FrameRequestCallback>();

	public now(): number { return this.time; }
	public requestFrame(callback: FrameRequestCallback): number {
		const handle = this.nextHandle++;
		this.callbacks.set(handle, callback);
		return handle;
	}
	public cancelFrame(handle: number): void { this.callbacks.delete(handle); }
	public step(milliseconds: number): void {
		this.time += milliseconds;
		const callbacks = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of callbacks) callback(this.time);
	}
	public get pendingFrames(): number { return this.callbacks.size; }
}

beforeEach(() => {
	motionPolicy.configure({ userEnabled: true, reducedMotion: false, documentVisible: true });
});

describe('inertiaMotionValue', () => {
	test('decays velocity to an exact projected endpoint and becomes idle', async () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const value = new MotionValue(0, clock);
		const handle = inertiaMotionValue(value, {
			velocity: 1000,
			timeConstant: 100,
			restVelocity: 1,
			bounce: false,
			clock,
			scheduler,
		});
		for (let i = 0; i < 240 && handle.status === 'running'; i += 1) clock.step(16);
		expect(handle.status).toBe('finished');
		expect(value.current).toBeCloseTo(100, 8);
		expect(value.velocity).toBe(0);
		expect(clock.pendingFrames).toBe(0);
		expect(await handle.finished).toBe('finished');
	});

	test('stops exactly at a hard bound when bounce is disabled', () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const value = new MotionValue(0, clock);
		const handle = inertiaMotionValue(value, {
			velocity: 2000,
			timeConstant: 250,
			max: 50,
			bounce: false,
			clock,
			scheduler,
		});
		for (let i = 0; i < 100 && handle.status === 'running'; i += 1) clock.step(16);
		expect(handle.status).toBe('finished');
		expect(value.current).toBe(50);
		expect(value.velocity).toBe(0);
	});

	test('reduced spatial motion skips directly to the clamped projected endpoint', async () => {
		motionPolicy.configure({ reducedMotion: true });
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const value = new MotionValue(10, clock);
		const handle = inertiaMotionValue(value, {
			velocity: 1000,
			timeConstant: 200,
			max: 80,
			clock,
			scheduler,
		});
		expect(value.current).toBe(80);
		expect(handle.status).toBe('finished');
		expect(clock.pendingFrames).toBe(0);
		expect(await handle.finished).toBe('finished');
	});

	test('cancellation removes its persistent scheduler task', async () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const value = new MotionValue(0, clock);
		const handle = inertiaMotionValue(value, { velocity: 1000, clock, scheduler });
		expect(clock.pendingFrames).toBe(1);
		handle.cancel();
		expect(clock.pendingFrames).toBe(0);
		expect(await handle.finished).toBe('cancelled');
	});
});
