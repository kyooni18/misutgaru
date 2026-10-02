/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { dragGesture } from '@/motion/core/gesture.js';
import type { MotionClock } from '@/motion/core/clock.js';

class ManualClock implements MotionClock {
	public time = 0;
	public now(): number { return this.time; }
	public requestFrame(): number { return 1; }
	public cancelFrame(): void {}
}

function pointer(type: string, init: PointerEventInit): PointerEvent {
	return new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, button: 0, ...init });
}

describe('dragGesture', () => {
	test('tracks the selected axis, velocity, elastic constraints, and restores touch action', () => {
		const clock = new ManualClock();
		const element = document.createElement('div');
		const capture = vi.fn();
		const release = vi.fn();
		Object.defineProperty(element, 'setPointerCapture', { configurable: true, value: capture });
		Object.defineProperty(element, 'releasePointerCapture', { configurable: true, value: release });
		element.style.touchAction = 'auto';
		const onEnd = vi.fn();
		const gesture = dragGesture(element, {
			axis: 'x',
			constraints: { x: { min: 0, max: 100 } },
			elastic: 0.2,
			inertia: false,
			clock,
			onEnd,
		});

		element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 10 }));
		expect(gesture.dragging).toBe(true);
		clock.time = 20;
		element.dispatchEvent(pointer('pointermove', { clientX: 150, clientY: 80 }));
		expect(gesture.x.current).toBe(110);
		expect(gesture.y.current).toBe(0);
		expect(gesture.x.velocity).toBeCloseTo(5500, 8);
		clock.time = 40;
		element.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 80 }));
		expect(gesture.dragging).toBe(false);
		expect(onEnd).toHaveBeenCalledOnce();
		expect(capture).toHaveBeenCalledWith(1);
		expect(release).toHaveBeenCalledWith(1);
		expect(element.style.touchAction).toBe('pan-y');

		gesture.destroy();
		expect(element.style.touchAction).toBe('auto');
	});

	test('destroy detaches pointer listeners', () => {
		const clock = new ManualClock();
		const element = document.createElement('div');
		const gesture = dragGesture(element, { inertia: false, clock });
		gesture.destroy();
		element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		clock.time = 16;
		element.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));
		expect(gesture.x.current).toBe(0);
		expect(gesture.y.current).toBe(0);
	});
});
