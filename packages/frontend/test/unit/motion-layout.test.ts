/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { animateLayoutChange } from '@/motion/core/layout.js';
import { motionPolicy } from '@/motion/core/policy.js';

function controllableAnimation() {
	let resolve!: () => void;
	let reject!: () => void;
	const finished = new Promise<void>((resolveFinished, rejectFinished) => {
		resolve = resolveFinished;
		reject = rejectFinished;
	});
	return {
		animation: {
			finished,
			commitStyles: vi.fn(),
			cancel: vi.fn(() => reject()),
			finish: vi.fn(() => resolve()),
			pause: vi.fn(),
			play: vi.fn(),
			reverse: vi.fn(),
		} as unknown as Animation,
		resolve,
	};
}

beforeEach(() => {
	motionPolicy.configure({ userEnabled: true, reducedMotion: false, documentVisible: true });
});

describe('animateLayoutChange', () => {
	test('uses independent translate and scale channels for FLIP projection', () => {
		const element = document.createElement('div');
		const native = controllableAnimation();
		const animate = vi.fn(() => native.animation);
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });

		const handle = animateLayoutChange(
			element,
			{ left: 20, top: 30, width: 100, height: 60 },
			{ left: 100, top: 90, width: 200, height: 120 },
		);
		expect(handle).not.toBeNull();
		const [frames] = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
		expect(frames[0]).toMatchObject({ translate: '-80px -60px', scale: '0.5 0.5' });
		expect(frames[1]).toMatchObject({ translate: '0 0', scale: '1 1' });
		expect(frames[0].transform).toBeUndefined();
	});

	test('does not animate when geometry is materially unchanged', () => {
		const element = document.createElement('div');
		const animate = vi.fn();
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });
		const handle = animateLayoutChange(
			element,
			{ left: 10, top: 20, width: 100, height: 50 },
			{ left: 10.2, top: 19.8, width: 100.1, height: 50 },
		);
		expect(handle).toBeNull();
		expect(animate).not.toHaveBeenCalled();
	});

	test('layout-only options never leak into native WAAPI timing options', () => {
		const element = document.createElement('div');
		const native = controllableAnimation();
		const animate = vi.fn(() => native.animation);
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });
		animateLayoutChange(
			element,
			{ left: 0, top: 0, width: 10, height: 10 },
			{ left: 20, top: 0, width: 20, height: 10 },
			{ translate: true, scale: false },
		);
		const [, timing] = animate.mock.calls[0] as unknown as [Keyframe[], Record<string, unknown>];
		expect(timing.translate).toBeUndefined();
		expect(timing.scale).toBeUndefined();
	});
});
