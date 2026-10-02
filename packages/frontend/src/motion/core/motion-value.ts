/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';

export type MotionValueSubscriber<T> = (value: T, previous: T) => void;

export class MotionValue<T> {
	private currentValue: T;
	private previousValue: T;
	private timestamp: number;
	private currentVelocity = 0;
	private readonly subscribers = new Set<MotionValueSubscriber<T>>();

	constructor(initialValue: T, private readonly clock: MotionClock = browserMotionClock) {
		this.currentValue = initialValue;
		this.previousValue = initialValue;
		this.timestamp = clock.now();
	}

	public get current(): T {
		return this.currentValue;
	}

	public get previous(): T {
		return this.previousValue;
	}

	public get velocity(): number {
		return this.currentVelocity;
	}

	public set(value: T, timestamp = this.clock.now(), velocity?: number): void {
		const previous = this.currentValue;
		const elapsed = timestamp - this.timestamp;
		this.previousValue = previous;
		this.currentValue = value;
		this.timestamp = timestamp;

		if (velocity != null) {
			this.currentVelocity = velocity;
		} else if (typeof value === 'number' && typeof previous === 'number' && elapsed > 0) {
			this.currentVelocity = ((value - previous) / elapsed) * 1000;
		} else {
			this.currentVelocity = 0;
		}

		if (Object.is(previous, value)) return;
		for (const subscriber of [...this.subscribers]) subscriber(value, previous);
	}

	public jump(value: T, timestamp = this.clock.now()): void {
		this.set(value, timestamp, 0);
	}

	public subscribe(subscriber: MotionValueSubscriber<T>, immediate = false): () => void {
		this.subscribers.add(subscriber);
		if (immediate) subscriber(this.currentValue, this.previousValue);
		return () => this.subscribers.delete(subscriber);
	}
}
