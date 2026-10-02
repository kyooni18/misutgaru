/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { animateMotion } from '@/motion/core/animation.js';
import { motionPolicy } from '@/motion/core/policy.js';
import { MotionScope } from '@/motion/core/scope.js';

function fakeNativeAnimation() {
	let resolveFinished!: () => void;
	let rejectFinished!: (reason?: unknown) => void;
	const finished = new Promise<void>((resolve, reject) => {
		resolveFinished = resolve;
		rejectFinished = reject;
	});
	const animation = {
		finished,
		commitStyles: vi.fn(),
		cancel: vi.fn(() => rejectFinished(new DOMException('cancelled', 'AbortError'))),
		finish: vi.fn(() => resolveFinished()),
		pause: vi.fn(),
		play: vi.fn(),
		reverse: vi.fn(),
	} as unknown as Animation;
	return { animation, resolveFinished };
}

beforeEach(() => {
	motionPolicy.configure({ userEnabled: true, reducedMotion: false, documentVisible: true });
});

describe('animateMotion', () => {
	test('commits the final value without invoking WAAPI when motion is disabled', async () => {
		motionPolicy.configure({ userEnabled: false });
		const element = document.createElement('div');
		const animate = vi.fn();
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });
		const handle = animateMotion(element, [{ opacity: 0 }, { opacity: 1 }], { preset: 'surfaceEnter' });
		expect(animate).not.toHaveBeenCalled();
		expect(element.style.opacity).toBe('1');
		expect(await handle.finished).toBe('finished');
	});

	test('replaces an existing owner of the same property and preserves its current presentation', async () => {
		const element = document.createElement('div');
		const firstNative = fakeNativeAnimation();
		const secondNative = fakeNativeAnimation();
		const animate = vi.fn()
			.mockReturnValueOnce(firstNative.animation)
			.mockReturnValueOnce(secondNative.animation);
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });

		const first = animateMotion(element, [{ opacity: 0 }, { opacity: 1 }]);
		const second = animateMotion(element, [{ opacity: 1 }, { opacity: 0.5 }]);

		expect(await first.finished).toBe('cancelled');
		expect(firstNative.animation.commitStyles).toHaveBeenCalledOnce();
		expect(firstNative.animation.cancel).toHaveBeenCalledOnce();
		expect(second.status).toBe('running');
	});

	test('does not cancel an animation that owns a different property', () => {
		const element = document.createElement('div');
		const opacityNative = fakeNativeAnimation();
		const scaleNative = fakeNativeAnimation();
		const animate = vi.fn()
			.mockReturnValueOnce(opacityNative.animation)
			.mockReturnValueOnce(scaleNative.animation);
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });

		const opacity = animateMotion(element, [{ opacity: 0 }, { opacity: 1 }]);
		const scale = animateMotion(element, [{ scale: 0.9 }, { scale: 1 }]);
		expect(opacity.status).toBe('running');
		expect(scale.status).toBe('running');
		expect(opacityNative.animation.cancel).not.toHaveBeenCalled();
	});

	test('retargets from the current computed value instead of the old nominal start', () => {
		const element = document.createElement('div');
		element.style.opacity = '0.4';
		const firstNative = fakeNativeAnimation();
		const secondNative = fakeNativeAnimation();
		const animate = vi.fn()
			.mockReturnValueOnce(firstNative.animation)
			.mockReturnValueOnce(secondNative.animation);
		Object.defineProperty(element, 'animate', { configurable: true, value: animate });

		const handle = animateMotion(element, [{ opacity: 0 }, { opacity: 1 }]);
		handle.retarget([{ opacity: 1 }, { opacity: 0 }]);
		const retargetFrames = animate.mock.calls[1][0] as Keyframe[];
		expect(retargetFrames[0].opacity).toBe('0.4');
		expect(handle.status).toBe('running');
	});

	test('cancels all owned animations when a scope is disposed', async () => {
		const element = document.createElement('div');
		const native = fakeNativeAnimation();
		Object.defineProperty(element, 'animate', { configurable: true, value: vi.fn(() => native.animation) });
		const scope = new MotionScope();
		const handle = animateMotion(element, [{ opacity: 0 }, { opacity: 1 }], { scope });
		scope.dispose();
		expect(await handle.finished).toBe('cancelled');
		expect(native.animation.cancel).toHaveBeenCalledOnce();
	});
});
