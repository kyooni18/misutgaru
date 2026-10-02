/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';
import { MotionValue } from './motion-value.js';
import { motionPolicy } from './policy.js';
import { motionScheduler } from './scheduler.js';
import type { MotionScheduler } from './scheduler.js';
import type { MotionCategory, MotionPlaybackHandle, MotionScopeLike, MotionStatus } from './types.js';

export type SpringPresetName = 'feedback' | 'control' | 'layout' | 'gentle';

export interface SpringDefinition {
	stiffness: number;
	damping: number;
	mass: number;
	restDelta: number;
	restVelocity: number;
}

export const springPresets = Object.freeze<Record<SpringPresetName, SpringDefinition>>({
	feedback: { stiffness: 650, damping: 42, mass: 1, restDelta: 0.001, restVelocity: 0.01 },
	control: { stiffness: 500, damping: 38, mass: 1, restDelta: 0.001, restVelocity: 0.01 },
	layout: { stiffness: 420, damping: 34, mass: 1, restDelta: 0.01, restVelocity: 0.05 },
	gentle: { stiffness: 280, damping: 30, mass: 1, restDelta: 0.01, restVelocity: 0.05 },
});

export interface SpringMotionOptions extends Partial<SpringDefinition> {
	preset?: SpringPresetName;
	velocity?: number;
	category?: MotionCategory;
	scope?: MotionScopeLike;
	scheduler?: MotionScheduler;
	clock?: MotionClock;
}

export interface MotionValueHandle extends MotionPlaybackHandle {
	retarget(target: number): void;
}

interface SpringSample {
	value: number;
	velocity: number;
}

function sampleSpring(displacement: number, velocity: number, elapsedSeconds: number, definition: SpringDefinition): SpringSample {
	const { stiffness, damping, mass } = definition;
	const omega0 = Math.sqrt(stiffness / mass);
	const zeta = damping / (2 * Math.sqrt(stiffness * mass));

	if (zeta < 1 - 1e-4) {
		const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
		const decay = Math.exp(-zeta * omega0 * elapsedSeconds);
		const a = displacement;
		const b = (velocity + zeta * omega0 * displacement) / omegaD;
		const cos = Math.cos(omegaD * elapsedSeconds);
		const sin = Math.sin(omegaD * elapsedSeconds);
		const wave = a * cos + b * sin;
		return {
			value: decay * wave,
			velocity: decay * ((-zeta * omega0 * wave) + (-a * omegaD * sin + b * omegaD * cos)),
		};
	}

	if (zeta > 1 + 1e-4) {
		const root = Math.sqrt(zeta * zeta - 1);
		const r1 = -omega0 * (zeta - root);
		const r2 = -omega0 * (zeta + root);
		const c1 = (velocity - r2 * displacement) / (r1 - r2);
		const c2 = displacement - c1;
		const e1 = Math.exp(r1 * elapsedSeconds);
		const e2 = Math.exp(r2 * elapsedSeconds);
		return {
			value: c1 * e1 + c2 * e2,
			velocity: c1 * r1 * e1 + c2 * r2 * e2,
		};
	}

	const decay = Math.exp(-omega0 * elapsedSeconds);
	const a = displacement;
	const b = velocity + omega0 * displacement;
	return {
		value: decay * (a + b * elapsedSeconds),
		velocity: decay * (b - omega0 * (a + b * elapsedSeconds)),
	};
}

class SpringMotionHandle implements MotionValueHandle {
	private readonly scheduler: MotionScheduler;
	private readonly clock: MotionClock;
	private readonly definition: SpringDefinition;
	private removeFrameTask: (() => void) | null = null;
	private startValue: number;
	private startVelocity: number;
	private targetValue: number;
	private reverseTarget: number;
	private startTime: number;
	private lastTime: number;
	private _status: MotionStatus = 'idle';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished: Promise<MotionStatus>;

	constructor(private readonly value: MotionValue<number>, target: number, options: SpringMotionOptions) {
		this.scheduler = options.scheduler ?? motionScheduler;
		this.clock = options.clock ?? browserMotionClock;
		const preset = springPresets[options.preset ?? 'control'];
		this.definition = {
			stiffness: options.stiffness ?? preset.stiffness,
			damping: options.damping ?? preset.damping,
			mass: options.mass ?? preset.mass,
			restDelta: options.restDelta ?? preset.restDelta,
			restVelocity: options.restVelocity ?? preset.restVelocity,
		};
		this.startValue = value.current;
		this.startVelocity = options.velocity ?? value.velocity;
		this.targetValue = target;
		this.reverseTarget = value.current;
		this.startTime = this.clock.now();
		this.lastTime = this.startTime;
		this.finished = new Promise(resolve => { this.resolveFinished = resolve; });

		const policy = motionPolicy.resolve('control', options.category ?? 'functional');
		if (policy.disabled || (policy.reduced && (options.category ?? 'functional') === 'spatial')) {
			this.value.jump(target, this.startTime);
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
		this.finalize('cancelled');
	}

	public finish(): void {
		if (this.isTerminal()) return;
		this.stopFrameLoop();
		this.value.jump(this.targetValue, this.clock.now());
		this.finalize('finished');
	}

	public pause(): void {
		if (this._status !== 'running') return;
		const sample = this.currentSample(this.lastTime);
		this.value.set(sample.value, this.lastTime, sample.velocity);
		this.startValue = sample.value;
		this.startVelocity = sample.velocity;
		this.stopFrameLoop();
		this._status = 'paused';
	}

	public play(): void {
		if (this._status !== 'paused') return;
		this.startValue = this.value.current;
		this.startVelocity = this.value.velocity;
		this.startTime = this.clock.now();
		this.lastTime = this.startTime;
		this._status = 'running';
		this.startFrameLoop();
	}

	public reverse(): void {
		if (this.isTerminal()) return;
		const nextTarget = this.reverseTarget;
		this.reverseTarget = this.targetValue;
		this.retarget(nextTarget);
	}

	public retarget(target: number): void {
		if (this.isTerminal()) return;
		const now = this.lastTime || this.clock.now();
		const sample = this.currentSample(now);
		this.value.set(sample.value, now, sample.velocity);
		this.startValue = sample.value;
		this.startVelocity = sample.velocity;
		this.reverseTarget = this.targetValue;
		this.targetValue = target;
		this.startTime = now;
		if (this._status === 'running') this.startFrameLoop();
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
		if (this._status !== 'running') return;
		this.lastTime = timestamp;
		const sample = this.currentSample(timestamp);
		const atRest = Math.abs(this.targetValue - sample.value) <= this.definition.restDelta
			&& Math.abs(sample.velocity) <= this.definition.restVelocity;

		if (atRest) this.stopFrameLoop();
		this.scheduler.scheduleWrite(() => {
			if (this.isTerminal()) return;
			if (atRest) {
				this.value.set(this.targetValue, timestamp, 0);
				this.finalize('finished');
			} else {
				this.value.set(sample.value, timestamp, sample.velocity);
			}
		});
	}

	private currentSample(timestamp: number): SpringSample {
		const elapsedSeconds = Math.max(0, timestamp - this.startTime) / 1000;
		const relative = sampleSpring(this.startValue - this.targetValue, this.startVelocity, elapsedSeconds, this.definition);
		return { value: this.targetValue + relative.value, velocity: relative.velocity };
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

export function springMotionValue(value: MotionValue<number>, target: number, options: SpringMotionOptions = {}): MotionValueHandle {
	const handle = new SpringMotionHandle(value, target, options);
	options.scope?.track(handle);
	return handle;
}
