/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test, vi } from 'vitest';
import { Animation } from 'vune-ui';
import { VuneMotionEngine } from '@/vune/motion.js';

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
		assert.strictEqual(element.style.opacity, '0');
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

	test('a new animation cancels only the previous animation for the same property', () => {
		const element = document.createElement('div');
		const engine = new VuneMotionEngine();
		const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
		Object.defineProperty(element, 'animate', {
			configurable: true,
			value: vi.fn(() => {
				const animation = nativeAnimation();
				animations.push(animation);
				return animation;
			}),
		});

		engine.animateElement(element, [
			{ opacity: 0 },
			{ opacity: 0.5 },
			{ opacity: 1 },
		], { animation: Animation.linear(0.5) });
		engine.animateElement(element, [
			{ transform: 'translateX(0px)' },
			{ transform: 'translateX(5px)' },
			{ transform: 'translateX(10px)' },
		], { animation: Animation.linear(0.5) });
		assert.strictEqual(animations[0].cancel.mock.calls.length, 0);

		engine.animateElement(element, [
			{ opacity: 1 },
			{ opacity: 0.5 },
			{ opacity: 0 },
		], { animation: Animation.linear(0.5) });
		assert.strictEqual(animations[0].cancel.mock.calls.length, 1);
		assert.strictEqual(animations[1].cancel.mock.calls.length, 0);
	});
});
