/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { browserMotionClock } from './clock.js';
import type { MotionClock } from './clock.js';
import { inertiaMotionValue } from './inertia.js';
import type { InertiaMotionHandle, InertiaMotionOptions, MotionBounds } from './inertia.js';
import { MotionValue } from './motion-value.js';

export type DragAxis = 'x' | 'y' | 'both';

export interface DragConstraints {
	x?: MotionBounds;
	y?: MotionBounds;
}

export interface DragGestureState {
	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	pointerEvent: PointerEvent;
}

export interface DragGestureOptions {
	x?: MotionValue<number>;
	y?: MotionValue<number>;
	axis?: DragAxis;
	constraints?: DragConstraints;
	elastic?: number;
	inertia?: boolean | Omit<InertiaMotionOptions, 'velocity' | 'min' | 'max'>;
	touchAction?: string | false;
	clock?: MotionClock;
	onStart?: (state: DragGestureState) => void;
	onMove?: (state: DragGestureState) => void;
	onEnd?: (state: DragGestureState) => void;
}

export interface DragGestureHandle {
	readonly x: MotionValue<number>;
	readonly y: MotionValue<number>;
	readonly dragging: boolean;
	cancelRelease(): void;
	destroy(): void;
}

function constrain(value: number, bounds: MotionBounds | undefined, elastic: number): number {
	if (bounds == null) return value;
	if (bounds.min != null && value < bounds.min) return bounds.min + ((value - bounds.min) * elastic);
	if (bounds.max != null && value > bounds.max) return bounds.max + ((value - bounds.max) * elastic);
	return value;
}

export function dragGesture(element: HTMLElement, options: DragGestureOptions = {}): DragGestureHandle {
	const clock = options.clock ?? browserMotionClock;
	const x = options.x ?? new MotionValue(0, clock);
	const y = options.y ?? new MotionValue(0, clock);
	const axis = options.axis ?? 'both';
	const elastic = Math.max(0, Math.min(1, options.elastic ?? 0.2));
	const abortController = new AbortController();
	let activePointer: number | null = null;
	let startPointerX = 0;
	let startPointerY = 0;
	let startX = 0;
	let startY = 0;
	let releaseX: InertiaMotionHandle | null = null;
	let releaseY: InertiaMotionHandle | null = null;
	const previousTouchAction = element.style.touchAction;

	if (options.touchAction !== false) {
		element.style.touchAction = options.touchAction ?? (axis === 'x' ? 'pan-y' : axis === 'y' ? 'pan-x' : 'none');
	}

	const state = (event: PointerEvent): DragGestureState => ({
		x: x.current,
		y: y.current,
		velocityX: x.velocity,
		velocityY: y.velocity,
		pointerEvent: event,
	});

	const cancelRelease = () => {
		releaseX?.cancel();
		releaseY?.cancel();
		releaseX = null;
		releaseY = null;
	};

	const startInertia = (value: MotionValue<number>, bounds: MotionBounds | undefined, velocity: number): InertiaMotionHandle | null => {
		if (options.inertia === false) return null;
		const inertiaOptions = typeof options.inertia === 'object' ? options.inertia : {};
		return inertiaMotionValue(value, {
			...inertiaOptions,
			velocity,
			min: bounds?.min,
			max: bounds?.max,
			category: inertiaOptions.category ?? 'spatial',
			clock: inertiaOptions.clock ?? clock,
		});
	};

	const onPointerDown = (event: PointerEvent) => {
		if (activePointer != null || event.button !== 0 || !event.isPrimary) return;
		cancelRelease();
		activePointer = event.pointerId;
		startPointerX = event.clientX;
		startPointerY = event.clientY;
		startX = x.current;
		startY = y.current;
		try { element.setPointerCapture(event.pointerId); } catch { /* unsupported/invalid capture */ }
		options.onStart?.(state(event));
	};

	const onPointerMove = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		const now = clock.now();
		if (axis === 'x' || axis === 'both') {
			x.set(constrain(startX + event.clientX - startPointerX, options.constraints?.x, elastic), now);
		}
		if (axis === 'y' || axis === 'both') {
			y.set(constrain(startY + event.clientY - startPointerY, options.constraints?.y, elastic), now);
		}
		options.onMove?.(state(event));
	};

	const finishPointer = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		try { element.releasePointerCapture(event.pointerId); } catch { /* capture may already be gone */ }
		const velocityX = x.velocity;
		const velocityY = y.velocity;
		if (axis === 'x' || axis === 'both') releaseX = startInertia(x, options.constraints?.x, velocityX);
		if (axis === 'y' || axis === 'both') releaseY = startInertia(y, options.constraints?.y, velocityY);
		options.onEnd?.({ x: x.current, y: y.current, velocityX, velocityY, pointerEvent: event });
	};

	element.addEventListener('pointerdown', onPointerDown, { signal: abortController.signal });
	element.addEventListener('pointermove', onPointerMove, { signal: abortController.signal });
	element.addEventListener('pointerup', finishPointer, { signal: abortController.signal });
	element.addEventListener('pointercancel', finishPointer, { signal: abortController.signal });

	return {
		x,
		y,
		get dragging() { return activePointer != null; },
		cancelRelease,
		destroy() {
			cancelRelease();
			abortController.abort();
			if (activePointer != null) {
				try { element.releasePointerCapture(activePointer); } catch { /* capture may already be gone */ }
				activePointer = null;
			}
			if (options.touchAction !== false) element.style.touchAction = previousTouchAction;
		},
	};
}
