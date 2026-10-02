/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { MotionScheduler } from '@/motion/core/scheduler.js';
import { parallelMotion, sequenceMotion, timelineMotion } from '@/motion/core/timeline.js';
import type { MotionClock } from '@/motion/core/clock.js';
import type { MotionPlaybackHandle, MotionStatus } from '@/motion/core/types.js';

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
}

class ControlledHandle implements MotionPlaybackHandle {
	private _status: MotionStatus = 'running';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished = new Promise<MotionStatus>(resolve => { this.resolveFinished = resolve; });
	public get status(): MotionStatus { return this._status; }
	public cancel(): void { this.settle('cancelled'); }
	public finish(): void { this.settle('finished'); }
	public pause = vi.fn(() => { if (this._status === 'running') this._status = 'paused'; });
	public play = vi.fn(() => { if (this._status === 'paused') this._status = 'running'; });
	public reverse = vi.fn();
	private settle(status: Extract<MotionStatus, 'finished' | 'cancelled'>): void {
		if (this._status === 'finished' || this._status === 'cancelled') return;
		this._status = status;
		this.resolveFinished(status);
	}
}

describe('motion timeline orchestration', () => {
	test('launches entries at deterministic offsets and finishes after children settle', async () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const first = new ControlledHandle();
		const second = new ControlledHandle();
		const firstFactory = vi.fn(() => first);
		const secondFactory = vi.fn(() => second);
		const timeline = timelineMotion([
			{ at: 0, start: firstFactory },
			{ at: 100, start: secondFactory },
		], { clock, scheduler });

		expect(firstFactory).toHaveBeenCalledOnce();
		expect(secondFactory).not.toHaveBeenCalled();
		clock.step(99);
		expect(secondFactory).not.toHaveBeenCalled();
		clock.step(1);
		expect(secondFactory).toHaveBeenCalledOnce();
		first.finish();
		second.finish();
		expect(await timeline.finished).toBe('finished');
	});

	test('pause excludes paused wall time from future entry offsets', () => {
		const clock = new FakeClock();
		const scheduler = new MotionScheduler(clock);
		const first = new ControlledHandle();
		const secondFactory = vi.fn(() => new ControlledHandle());
		const timeline = timelineMotion([
			{ at: 0, start: () => first },
			{ at: 100, start: secondFactory },
		], { clock, scheduler });
		clock.step(40);
		timeline.pause();
		clock.step(100);
		expect(secondFactory).not.toHaveBeenCalled();
		timeline.play();
		clock.step(59);
		expect(secondFactory).not.toHaveBeenCalled();
		clock.step(1);
		expect(secondFactory).toHaveBeenCalledOnce();
		timeline.cancel();
	});

	test('sequence starts the next factory only after the active child settles', async () => {
		const first = new ControlledHandle();
		const second = new ControlledHandle();
		const secondFactory = vi.fn(() => second);
		const sequence = sequenceMotion([() => first, secondFactory]);
		expect(secondFactory).not.toHaveBeenCalled();
		first.finish();
		await Promise.resolve();
		expect(secondFactory).toHaveBeenCalledOnce();
		second.finish();
		expect(await sequence.finished).toBe('finished');
	});

	test('parallel starts all children immediately and propagates cancellation', async () => {
		const first = new ControlledHandle();
		const second = new ControlledHandle();
		const parallel = parallelMotion([() => first, () => second]);
		expect(parallel.activeChildren).toHaveLength(2);
		parallel.cancel();
		expect(first.status).toBe('cancelled');
		expect(second.status).toBe('cancelled');
		expect(await parallel.finished).toBe('cancelled');
	});
});
