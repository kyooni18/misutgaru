/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test, vi } from 'vitest';
import { Animation } from 'vune-ui';
import { surfaceMotionAnimation, surfaceScaleKeyframes, uiMotion, VuneMotionEngine } from '@/vune/motion.js';

const nativeAnimation = () => {
	const finished = new Promise<void>(() => {});
	return {
		finished,
		cancel: vi.fn(),
	};
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('VuneMotionEngine', () => {
	test('uses the shared Vune clock for regular numeric interpolation', async () => {
		const progress: number[] = [];
		const engine = new VuneMotionEngine();

		const handle = engine.animate({
			animation: Animation.linear(0.03),
			onUpdate: value => progress.push(value),
		});

		assert.strictEqual(await handle.finished, 'finished');
		assert.ok(progress.length > 1);
		assert.strictEqual(progress.at(-1), 1);
	});

	test('interpolates multi-keyframe styles without falling back to WAAPI', async () => {
		const element = document.createElement('div');
		const animate = vi.fn();
		Object.defineProperty(element, 'animate', { value: animate, configurable: true });
		const engine = new VuneMotionEngine();

		const handle = engine.animateElement(element, [
			{ offset: 0, opacity: 0 },
			{ offset: 0.5, opacity: 1 },
			{ offset: 1, opacity: 0 },
		], { animation: Animation.linear(0.03), fill: 'forwards' });

		assert.strictEqual(await handle.finished, 'finished');
		assert.strictEqual(animate.mock.calls.length, 0);
		assert.strictEqual(element.style.opacity, '0');
	});

	test('reduced motion preserves the final direction for numeric autoreverses', async () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const progress: number[] = [];
		const engine = new VuneMotionEngine();

		const handle = engine.animate({
			animation: Animation.linear(0.5).repeatCount(2, true),
			onUpdate: value => progress.push(value),
		});

		assert.strictEqual(await handle.finished, 'finished');
		assert.deepStrictEqual(progress, [0]);
	});

	test('reduced motion commits the final interpolated keyframe, including autoreverse parity', async () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const element = document.createElement('div');
		const engine = new VuneMotionEngine();

		const handle = engine.animateElement(element, [
			{ opacity: 0 },
			{ opacity: 1 },
		], {
			animation: Animation.linear(0.5).repeatCount(2, true),
			fill: 'none',
		});

		assert.strictEqual(await handle.finished, 'finished');
		assert.strictEqual(element.style.opacity, '');
	});

	test('reduced motion applies the final native keyframe when interpolation falls back to WAAPI', async () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const element = document.createElement('div');
		const engine = new VuneMotionEngine();
		Object.defineProperty(element, 'animate', { value: vi.fn(), configurable: true });

		const handle = engine.animateElement(element, [
			{ opacity: 0 },
			{ opacity: 0.5 },
			{ opacity: 1 },
		], { animation: Animation.easeOut(0.5) });

		assert.strictEqual(await handle.finished, 'finished');
		assert.strictEqual(element.style.opacity, '1');
		assert.strictEqual((element.animate as unknown as ReturnType<typeof vi.fn>).mock.calls.length, 0);
	});

	test('reduced motion respects non-persistent fill modes', async () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const element = document.createElement('div');
		element.style.setProperty('opacity', '0.25', 'important');
		const engine = new VuneMotionEngine();

		const handle = engine.animateElement(element, [
			{ opacity: 0 },
			{ opacity: 1 },
		], { animation: Animation.linear(0.5), fill: 'none' });

		assert.strictEqual(await handle.finished, 'finished');
		assert.strictEqual(element.style.opacity, '0.25');
		assert.strictEqual(element.style.getPropertyPriority('opacity'), 'important');
	});

	test('cancelling interpolated motion restores the original inline style', async () => {
		const element = document.createElement('div');
		element.style.setProperty('opacity', '0.25', 'important');
		const engine = new VuneMotionEngine();

		const handle = engine.animateElement(element, [
			{ opacity: 0 },
			{ opacity: 1 },
		], { animation: Animation.linear(1), fill: 'forwards' });
		handle.cancel();

		assert.strictEqual(await handle.finished, 'cancelled');
		assert.strictEqual(element.style.opacity, '0.25');
		assert.strictEqual(element.style.getPropertyPriority('opacity'), 'important');
	});

	test('overlapping one property does not cancel sibling tracks from the same request', () => {
		const element = document.createElement('div');
		const engine = new VuneMotionEngine();
		const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
		const prototype = Object.getPrototypeOf(element) as HTMLElement;
		const originalAnimate = Object.getOwnPropertyDescriptor(prototype, 'animate');
		Object.defineProperty(prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => {
				const animation = nativeAnimation();
				animations.push(animation);
				return animation;
			}),
		});
		try {
			engine.animateElement(element, [
				{ opacity: 0, transform: 'translateX(0px)', easing: 'linear' },
				{ opacity: 1, transform: 'translateX(10px)', easing: 'linear' },
			], { animation: Animation.linear(0.5) });
			assert.strictEqual(animations.length, 2);

			engine.animateElement(element, [
				{ opacity: 1, easing: 'linear' },
				{ opacity: 0, easing: 'linear' },
			], { animation: Animation.linear(0.5) });

			assert.strictEqual(animations.length, 3);
			assert.strictEqual(animations[0].cancel.mock.calls.length, 1);
			assert.strictEqual(animations[1].cancel.mock.calls.length, 0);
		} finally {
			if (originalAnimate) Object.defineProperty(prototype, 'animate', originalAnimate);
			else delete (prototype as { animate?: unknown }).animate;
		}
	});
});

describe('Misutgaru motion vocabulary', () => {
	test('uses one semantic animation pair for transient surfaces', () => {
		assert.strictEqual(surfaceMotionAnimation('enter'), uiMotion.surfaceEnter);
		assert.strictEqual(surfaceMotionAnimation('leave'), uiMotion.surfaceLeave);
		assert.strictEqual(uiMotion.surfaceEnter.descriptor.kind, 'spring');
		assert.strictEqual(uiMotion.surfaceLeave.descriptor.kind, 'easeIn');
	});

	test('builds symmetric surface scale keyframes', () => {
		const enter = surfaceScaleKeyframes('enter', 0.95);
		const leave = surfaceScaleKeyframes('leave', 0.95);
		assert.deepStrictEqual(enter, [
			{ opacity: 0, transform: 'scale(0.95)' },
			{ opacity: 1, transform: 'scale(1)' },
		]);
		assert.deepStrictEqual(leave, [...enter].reverse());
	});
});
