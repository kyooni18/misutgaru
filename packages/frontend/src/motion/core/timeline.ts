/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';
import { motionScheduler } from './scheduler.js';
import type { MotionScheduler } from './scheduler.js';
import type { MotionPlaybackHandle, MotionScopeLike, MotionStatus } from './types.js';

export type MotionFactory = () => MotionPlaybackHandle;

export interface MotionTimelineEntry {
	at: number;
	start: MotionFactory;
	label?: string;
}

export interface MotionTimelineOptions {
	scope?: MotionScopeLike;
	clock?: MotionClock;
	scheduler?: MotionScheduler;
}

export interface MotionTimelineHandle extends MotionPlaybackHandle {
	readonly activeChildren: readonly MotionPlaybackHandle[];
}

class ScheduledTimelineHandle implements MotionTimelineHandle {
	private readonly entries: MotionTimelineEntry[];
	private readonly clock: MotionClock;
	private readonly scheduler: MotionScheduler;
	private readonly children = new Set<MotionPlaybackHandle>();
	private removeFrameTask: (() => void) | null = null;
	private nextIndex = 0;
	private startedAt: number;
	private pausedAt: number | null = null;
	private pausedDuration = 0;
	private _status: MotionStatus = 'idle';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished: Promise<MotionStatus>;

	constructor(entries: readonly MotionTimelineEntry[], options: MotionTimelineOptions) {
		this.entries = [...entries]
			.map(entry => ({ ...entry, at: Math.max(0, entry.at) }))
			.sort((a, b) => a.at - b.at);
		this.clock = options.clock ?? browserMotionClock;
		this.scheduler = options.scheduler ?? motionScheduler;
		this.startedAt = this.clock.now();
		this.finished = new Promise(resolve => { this.resolveFinished = resolve; });

		if (this.entries.length === 0) {
			this.finalize('finished');
			return;
		}

		this._status = 'running';
		this.launchDue(0);
		if (!this.isComplete()) this.startFrameLoop();
	}

	public get status(): MotionStatus {
		return this._status;
	}

	public get activeChildren(): readonly MotionPlaybackHandle[] {
		return [...this.children];
	}

	public cancel(): void {
		if (this.isTerminal()) return;
		this.stopFrameLoop();
		for (const child of [...this.children]) child.cancel();
		this.children.clear();
		this.finalize('cancelled');
	}

	public finish(): void {
		if (this.isTerminal()) return;
		this.stopFrameLoop();
		while (this.nextIndex < this.entries.length) this.launch(this.entries[this.nextIndex++]);
		for (const child of [...this.children]) child.finish();
		if (this.children.size === 0) this.finalize('finished');
	}

	public pause(): void {
		if (this._status !== 'running') return;
		this.pausedAt = this.clock.now();
		this.stopFrameLoop();
		for (const child of this.children) child.pause();
		this._status = 'paused';
	}

	public play(): void {
		if (this._status !== 'paused') return;
		const now = this.clock.now();
		if (this.pausedAt != null) this.pausedDuration += Math.max(0, now - this.pausedAt);
		this.pausedAt = null;
		for (const child of this.children) child.play();
		this._status = 'running';
		if (!this.isComplete()) this.startFrameLoop();
	}

	public reverse(): void {
		if (this.isTerminal()) return;
		for (const child of this.children) child.reverse();
	}

	private startFrameLoop(): void {
		if (this.removeFrameTask != null || this.nextIndex >= this.entries.length) return;
		this.removeFrameTask = this.scheduler.addFrameTask(timestamp => {
			if (this._status !== 'running') return;
			this.launchDue(timestamp - this.startedAt - this.pausedDuration);
			if (this.nextIndex >= this.entries.length) this.stopFrameLoop();
		});
	}

	private stopFrameLoop(): void {
		this.removeFrameTask?.();
		this.removeFrameTask = null;
	}

	private launchDue(elapsed: number): void {
		while (this.nextIndex < this.entries.length && this.entries[this.nextIndex].at <= elapsed) {
			this.launch(this.entries[this.nextIndex++]);
		}
		this.finishIfComplete();
	}

	private launch(entry: MotionTimelineEntry): void {
		if (this.isTerminal()) return;
		const child = entry.start();
		this.children.add(child);
		void child.finished.then(() => {
			this.children.delete(child);
			this.finishIfComplete();
		});
	}

	private isComplete(): boolean {
		return this.nextIndex >= this.entries.length && this.children.size === 0;
	}

	private finishIfComplete(): void {
		if (this._status === 'running' && this.isComplete()) {
			this.stopFrameLoop();
			this.finalize('finished');
		}
	}

	private finalize(status: Extract<MotionStatus, 'finished' | 'cancelled'>): void {
		if (this.isTerminal()) return;
		this._status = status;
		this.resolveFinished(status);
	}

	private isTerminal(): boolean {
		return this._status === 'finished' || this._status === 'cancelled';
	}
}

class SequenceMotionHandle implements MotionTimelineHandle {
	private readonly factories: MotionFactory[];
	private readonly children = new Set<MotionPlaybackHandle>();
	private index = 0;
	private active: MotionPlaybackHandle | null = null;
	private _status: MotionStatus = 'idle';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished: Promise<MotionStatus>;

	constructor(factories: readonly MotionFactory[]) {
		this.factories = [...factories];
		this.finished = new Promise(resolve => { this.resolveFinished = resolve; });
		if (this.factories.length === 0) {
			this.finalize('finished');
		} else {
			this._status = 'running';
			this.startNext();
		}
	}

	public get status(): MotionStatus { return this._status; }
	public get activeChildren(): readonly MotionPlaybackHandle[] { return [...this.children]; }

	public cancel(): void {
		if (this.isTerminal()) return;
		this.active?.cancel();
		this.active = null;
		this.children.clear();
		this.finalize('cancelled');
	}

	public finish(): void {
		if (this.isTerminal()) return;
		this.active?.finish();
		while (this.index < this.factories.length) {
			const child = this.factories[this.index++]();
			child.finish();
		}
		this.active = null;
		this.children.clear();
		this.finalize('finished');
	}

	public pause(): void {
		if (this._status !== 'running') return;
		this.active?.pause();
		this._status = 'paused';
	}

	public play(): void {
		if (this._status !== 'paused') return;
		this._status = 'running';
		if (this.active != null) this.active.play();
		else this.startNext();
	}

	public reverse(): void {
		if (this.isTerminal()) return;
		this.active?.reverse();
	}

	private startNext(): void {
		if (this.isTerminal() || this._status !== 'running') return;
		if (this.index >= this.factories.length) {
			this.finalize('finished');
			return;
		}
		const child = this.factories[this.index++]();
		this.active = child;
		this.children.add(child);
		void child.finished.then(() => {
			this.children.delete(child);
			if (this.active === child) this.active = null;
			if (this._status === 'running') this.startNext();
		});
	}

	private finalize(status: Extract<MotionStatus, 'finished' | 'cancelled'>): void {
		if (this.isTerminal()) return;
		this._status = status;
		this.resolveFinished(status);
	}

	private isTerminal(): boolean {
		return this._status === 'finished' || this._status === 'cancelled';
	}
}

export function timelineMotion(entries: readonly MotionTimelineEntry[], options: MotionTimelineOptions = {}): MotionTimelineHandle {
	const handle = new ScheduledTimelineHandle(entries, options);
	options.scope?.track(handle);
	return handle;
}

export function parallelMotion(factories: readonly MotionFactory[], options: MotionTimelineOptions = {}): MotionTimelineHandle {
	return timelineMotion(factories.map(start => ({ at: 0, start })), options);
}

export function staggerMotion(factories: readonly MotionFactory[], interval: number, options: MotionTimelineOptions = {}): MotionTimelineHandle {
	const gap = Math.max(0, interval);
	return timelineMotion(factories.map((start, index) => ({ at: index * gap, start })), options);
}

export function sequenceMotion(factories: readonly MotionFactory[], options: Pick<MotionTimelineOptions, 'scope'> = {}): MotionTimelineHandle {
	const handle = new SequenceMotionHandle(factories);
	options.scope?.track(handle);
	return handle;
}
