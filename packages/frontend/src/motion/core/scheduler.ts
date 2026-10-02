/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';

type ScheduledTask = () => void;
type ScheduledFrameTask = (timestamp: number) => void;

export class MotionScheduler {
	private readonly clock: MotionClock;
	private reads: ScheduledTask[] = [];
	private writes: ScheduledTask[] = [];
	private readonly frameTasks = new Set<ScheduledFrameTask>();
	private frameHandle: number | null = null;
	private phase: 'idle' | 'frame' | 'read' | 'write' = 'idle';

	constructor(clock: MotionClock = browserMotionClock) {
		this.clock = clock;
	}

	public scheduleRead(task: ScheduledTask): () => void {
		this.reads.push(task);
		if (this.phase !== 'frame') this.requestFlush();
		return () => this.removeTask(this.reads, task);
	}

	public scheduleWrite(task: ScheduledTask): () => void {
		this.writes.push(task);
		if (this.phase !== 'frame' && this.phase !== 'read') this.requestFlush();
		return () => this.removeTask(this.writes, task);
	}

	public addFrameTask(task: ScheduledFrameTask): () => void {
		this.frameTasks.add(task);
		this.requestFlush();
		return () => {
			this.frameTasks.delete(task);
			this.cancelIdleFrame();
		};
	}

	public get active(): boolean {
		return this.frameHandle != null || this.phase !== 'idle';
	}

	public clear(): void {
		this.reads.length = 0;
		this.writes.length = 0;
		this.frameTasks.clear();
		if (this.frameHandle != null) {
			this.clock.cancelFrame(this.frameHandle);
			this.frameHandle = null;
		}
	}

	private removeTask(queue: ScheduledTask[], task: ScheduledTask): void {
		const index = queue.indexOf(task);
		if (index >= 0) queue.splice(index, 1);
		this.cancelIdleFrame();
	}

	private cancelIdleFrame(): void {
		if (this.reads.length === 0 && this.writes.length === 0 && this.frameTasks.size === 0 && this.frameHandle != null) {
			this.clock.cancelFrame(this.frameHandle);
			this.frameHandle = null;
		}
	}

	private requestFlush(): void {
		if (this.frameHandle != null) return;
		this.frameHandle = this.clock.requestFrame(timestamp => this.flush(timestamp));
	}

	private flush(timestamp: number): void {
		this.frameHandle = null;

		this.phase = 'frame';
		for (const task of [...this.frameTasks]) task(timestamp);

		this.phase = 'read';
		const reads = this.reads;
		this.reads = [];
		for (const task of reads) task();

		// Writes queued by frame/read work belong to the same frame. Reads queued
		// by writes are deferred so a flush never alternates read/write/read.
		this.phase = 'write';
		const writes = this.writes;
		this.writes = [];
		for (const task of writes) task();

		this.phase = 'idle';
		if (this.reads.length > 0 || this.writes.length > 0 || this.frameTasks.size > 0) this.requestFlush();
	}
}

export const motionScheduler = new MotionScheduler();
