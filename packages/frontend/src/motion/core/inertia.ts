/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';
import { MotionValue } from './motion-value.js';
import { motionPolicy } from './policy.js';
import { motionScheduler } from './scheduler.js';
import type { MotionScheduler } from './scheduler.js';
import { springMotionValue } from './spring.js';
import type { MotionValueHandle, SpringPresetName } from './spring.js';
import type { MotionCategory, MotionPlaybackHandle, MotionScopeLike, MotionStatus } from './types.js';

export interface MotionBounds {
	min?: number;
	max?: number;
}

export interface InertiaMotionOptions extends MotionBounds {
	velocity?: number;
	timeConstant?: number;
	restVelocity?: number;
	bounce?: SpringPresetName | false;
	category?: MotionCategory;
	scope?: MotionScopeLike;
	scheduler?: MotionScheduler;
	clock?: MotionClock;
}

export type InertiaMotionHandle = MotionPlaybackHandle;

function clamp(value: number, bounds: MotionBounds): number {
	return Math.min(bounds.max ?? Number.POSITIVE_INFINITY, Math.max(bounds.min ?? Number.NEGATIVE_INFINITY, value));
}

class InertiaHandle implements InertiaMotionHandle {
	private readonly scheduler: MotionScheduler;
	private readonly clock: MotionClock;
	private readonly timeConstant: number;
	private readonly restVelocity: number;
	private readonly bounds: MotionBounds;
	private readonly bounce: SpringPresetName | false;
	private readonly category: MotionCategory;
	private removeFrameTask: (() => void) | null = null;
	private childSpring: MotionValueHandle | null = null;
	private startValue: number;
	private startVelocity: number;
	private startTime: number;
	private lastTime: number;
	private asymptote: number;
	private _status: MotionStatus = 'idle';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished: Promise<MotionStatus>;

	constructor(private readonly value: MotionValue<number>, options: InertiaMotionOptions) {
		this.scheduler = options.scheduler ?? motionScheduler;
		this.clock = options.clock ?? browserMotionClock;
		this.timeConstant = Math.max(1, options.timeConstant ?? 325);
		this.restVelocity = Math.max(0.001, options.restVelocity ?? 5);
		this.bounds = { min: options.min, max: options.max };
		this.bounce = options.bounce ?? 'control';
		this.category = options.category ?? 'spatial';
		this.startValue = value.current;
		this.startVelocity = options.velocity ?? value.velocity;
		this.startTime = this.clock.now();
		this.lastTime = this.startTime;
		this.asymptote = this.projectedTarget();
		this.finished = new Promise(resolve => { this.resolveFinished = resolve; });

		const policy = motionPolicy.resolve('control', this.category);
		if (policy.disabled || (policy.reduced && this.category === 'spatial')) {
			this.value.jump(clamp(this.asymptote, this.bounds), this.startTime);
			this.finalize('finished');
		} else if (Math.abs(this.startVelocity) <= this.restVelocity) {
			this.value.jump(clamp(this.startValue, this.bounds), this.startTime);
			this.finalize('finished');
		} else {
			this._status = 'running';
			this.startFrameLoop();
		}
	}

	public get status(): MotionStatus {
		return this._status;
	}

	public cancel(): void {
		if (this.isTerminal()) return;
		this.stopFrameLoop();
		this.childSpring?.cancel();
		this.childSpring = null;
		this.finalize('cancelled');
	}

	public finish(): void {
		if (this.isTerminal()) return;
		this.stopFrameLoop();
		this.childSpring?.cancel();
		this.childSpring = null;
		this.value.jump(clamp(this.asymptote, this.bounds), this.clock.now());
		this.finalize('finished');
	}

	public pause(): void {
		if (this._status !== 'running') return;
		if (this.childSpring != null) {
			this.childSpring.pause();
			this._status = 'paused';
			return;
		}
		const sample = this.sample(this.lastTime);
		this.value.set(sample.value, this.lastTime, sample.velocity);
		this.startValue = sample.value;
		this.startVelocity = sample.velocity;
		this.asymptote = this.projectedTarget();
		this.stopFrameLoop();
		this._status = 'paused';
	}

	public play(): void {
		if (this._status !== 'paused') return;
		if (this.childSpring != null) {
			this.childSpring.play();
			this._status = 'running';
			return;
		}
		this.startValue = this.value.current;
		this.startVelocity = this.value.velocity;
		this.startTime = this.clock.now();
		this.lastTime = this.startTime;
		this.asymptote = this.projectedTarget();
		this._status = 'running';
		this.startFrameLoop();
	}

	public reverse(): void {
		if (this.isTerminal()) return;
		if (this.childSpring != null) {
			this.childSpring.reverse();
			return;
		}
		const now = this.lastTime || this.clock.now();
		const sample = this.sample(now);
		this.value.set(sample.value, now, -sample.velocity);
		this.startValue = sample.value;
		this.startVelocity = -sample.velocity;
		this.startTime = now;
		this.asymptote = this.projectedTarget();
	}

	private projectedTarget(): number {
		return this.startValue + (this.startVelocity * this.timeConstant / 1000);
	}

	private sample(timestamp: number): { value: number; velocity: number } {
		const elapsed = Math.max(0, timestamp - this.startTime);
		const decay = Math.exp(-elapsed / this.timeConstant);
		return {
			value: this.startValue + (this.startVelocity * this.timeConstant / 1000) * (1 - decay),
			velocity: this.startVelocity * decay,
		};
	}

	private startFrameLoop(): void {
		if (this.removeFrameTask != null) return;
		this.removeFrameTask = this.scheduler.addFrameTask(timestamp => this.tick(timestamp));
	}

	private stopFrameLoop(): void {
		this.removeFrameTask?.();
		this.removeFrameTask = null;
	}

	private tick(timestamp: number): void {
		if (this._status !== 'running' || this.childSpring != null) return;
		this.lastTime = timestamp;
		const sample = this.sample(timestamp);
		const bounded = clamp(sample.value, this.bounds);
		const hitBound = bounded !== sample.value;
		const atRest = Math.abs(sample.velocity) <= this.restVelocity;

		if (hitBound || atRest) this.stopFrameLoop();
		this.scheduler.scheduleWrite(() => {
			if (this.isTerminal() || this.childSpring != null) return;
			if (hitBound) {
				if (this.bounce === false) {
					this.value.set(bounded, timestamp, 0);
					this.finalize('finished');
				} else {
					this.value.set(bounded, timestamp, sample.velocity);
					this.startBounce(bounded, sample.velocity);
				}
			} else if (atRest) {
				this.value.set(clamp(this.asymptote, this.bounds), timestamp, 0);
				this.finalize('finished');
			} else {
				this.value.set(sample.value, timestamp, sample.velocity);
			}
		});
	}

	private startBounce(bound: number, velocity: number): void {
		this.childSpring = springMotionValue(this.value, bound, {
			preset: this.bounce || 'control',
			velocity,
			category: this.category,
			scheduler: this.scheduler,
			clock: this.clock,
		});
		void this.childSpring.finished.then(status => {
			this.childSpring = null;
			if (this.isTerminal()) return;
			this.finalize(status === 'finished' ? 'finished' : 'cancelled');
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

export function inertiaMotionValue(value: MotionValue<number>, options: InertiaMotionOptions = {}): InertiaMotionHandle {
	const handle = new InertiaHandle(value, options);
	options.scope?.track(handle);
	return handle;
}
