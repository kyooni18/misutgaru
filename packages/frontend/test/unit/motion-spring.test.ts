/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { MotionValue } from '@/motion/core/motion-value.js';
import { motionPolicy } from '@/motion/core/policy.js';
import { MotionScheduler } from '@/motion/core/scheduler.js';
import { springMotionValue } from '@/motion/core/spring.js';
import type { MotionClock } from '@/motion/core/clock.js';

class FakeClock implements MotionClock {
	public time = 0;
	private nextHandle = 1;
	private callbacks = new Map<number, FrameRequestCallback>();

	public now(): number {
		return this.time;
	}

	public requestFrame(callback: FrameRequestCallback): number {
		const handle = this.nextHandle++;
		this.callbacks.set(handle, callback);
		return handle;
	}

	public cancelFrame(handle: number): void {
		this.callbacks.delete(handle);
	}

	public step(milliseconds: number): void {
		this.time += milliseconds;
		const callbacks = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of callbacks) callback(this.time);
	}

	public get pendingFrames(): number {
		return this.callbacks.size;
	}
}

function createSpring(initial = 0, target = 1) {
	const clock = new FakeClock();
	const scheduler = new MotionScheduler(clock);
	const value = new MotionValue(initial, clock);
	const handle = springMotionValue(value, target, { clock, scheduler, preset: 'control' });
	return { clock, scheduler, value, handle };
}

beforeEach(() => {
	motionPolicy.configure({ userEnabled: true, reducedMotion: false, documentVisible: true });
});

describe('springMotionValue', () => {
	test('converges to the exact target and stops requesting frames', async () => {
		const { clock, value, handle } = createSpring();
		for (let i = 0; i < 240 && handle.status === 'running'; i += 1) clock.step(1000 / 60);
		expect(handle.status).toBe('finished');
		expect(value.current).toBe(1);
		expect(value.velocity).toBe(0);
		expect(clock.pendingFrames).toBe(0);
		expect(await handle.finished).toBe('finished');
	});

	test('analytic evaluation is effectively independent of frame cadence', () => {
		const sixty = createSpring();
		const thirty = createSpring();
		for (let i = 0; i < 30; i += 1) sixty.clock.step(1000 / 60);
		for (let i = 0; i < 15; i += 1) thirty.clock.step(1000 / 30);
		expect(sixty.value.current).toBeCloseTo(thirty.value.current, 8);
		expect(sixty.value.velocity).toBeCloseTo(thirty.value.velocity, 8);
	});

	test('retargets without discarding current velocity', () => {
		const { clock, value, handle } = createSpring(0, 100);
		for (let i = 0; i < 5; i += 1) clock.step(16);
		const before = value.current;
		const velocity = value.velocity;
		handle.retarget(-50);
		clock.step(16);
		expect(before).not.toBe(0);
		expect(Math.abs(velocity)).toBeGreaterThan(0);
		expect(value.current).not.toBe(-50);
		expect(handle.status).toBe('running');
	});

	test('spatial springs become exact jumps under reduced motion', async () => {
		motionPolicy.configure({ reducedMotion: true });
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const value = new MotionValue(4, clock);
		const handle = springMotionValue(value, 12, { clock, scheduler, category: 'spatial' });
		expect(value.current).toBe(12);
		expect(handle.status).toBe('finished');
		expect(clock.pendingFrames).toBe(0);
		expect(await handle.finished).toBe('finished');
	});
});
