/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onBeforeUnmount, onBeforeUpdate, onUpdated } from 'vue';
import type { Ref } from 'vue';
import { animateLayoutChange, captureLayout, motionScheduler } from '../core/index.js';
import type { LayoutMotionOptions, LayoutSnapshot, MotionHandle } from '../core/index.js';

export function useLayoutMotion(
	target: Readonly<Ref<HTMLElement | SVGElement | null | undefined>>,
	options: LayoutMotionOptions = {},
): void {
	let from: LayoutSnapshot | null = null;
	let handle: MotionHandle | null = null;
	let cancelRead: (() => void) | null = null;
	let cancelWrite: (() => void) | null = null;

	const cancelScheduled = () => {
		cancelRead?.();
		cancelWrite?.();
		cancelRead = null;
		cancelWrite = null;
	};

	onBeforeUpdate(() => {
		cancelScheduled();
		const element = target.value;
		if (element == null) {
			from = null;
			return;
		}

		// Capture the currently projected visual rectangle before cancelling an
		// interrupted FLIP. Vue then patches the subtree against the base layout.
		from = captureLayout(element);
		handle?.cancel();
		handle = null;
	});

	onUpdated(() => {
		const element = target.value;
		const previous = from;
		if (element == null || previous == null) return;
		cancelRead = motionScheduler.scheduleRead(() => {
			cancelRead = null;
			const next = captureLayout(element);
			cancelWrite = motionScheduler.scheduleWrite(() => {
				cancelWrite = null;
				handle = animateLayoutChange(element, previous, next, options);
				from = null;
			});
		});
	});

	onBeforeUnmount(() => {
		cancelScheduled();
		handle?.cancel();
		handle = null;
		from = null;
	});
}
