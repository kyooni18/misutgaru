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
			{ opacity: 0, display: 'block' },
			{ opacity: 0.5, display: 'block' },
			{ opacity: 1, display: 'block' },
		], { animation: Animation.linear(0.5) });
		engine.animateElement(element, [
			{ transform: 'translateX(0px)', visibility: 'visible' },
			{ transform: 'translateX(5px)', visibility: 'visible' },
			{ transform: 'translateX(10px)', visibility: 'visible' },
		], { animation: Animation.linear(0.5) });
		assert.strictEqual(animations[0].cancel.mock.calls.length, 0);

		engine.animateElement(element, [
			{ opacity: 1, display: 'block' },
			{ opacity: 0.5, display: 'block' },
			{ opacity: 0, display: 'block' },
		], { animation: Animation.linear(0.5) });
		assert.strictEqual(animations[0].cancel.mock.calls.length, 1);
		assert.strictEqual(animations[1].cancel.mock.calls.length, 0);
	});
});
