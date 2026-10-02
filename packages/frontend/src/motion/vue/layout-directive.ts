/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Directive } from 'vue';
import { animateLayoutChange, captureLayout, motionScheduler } from '../core/index.js';
import type { LayoutMotionOptions, LayoutSnapshot, MotionHandle } from '../core/index.js';

type LayoutDirectiveValue = boolean | LayoutMotionOptions | undefined;

interface LayoutDirectiveState {
	from: LayoutSnapshot | null;
	handle: MotionHandle | null;
	cancelRead: (() => void) | null;
	cancelWrite: (() => void) | null;
}

const states = new WeakMap<HTMLElement, LayoutDirectiveState>();

function stateFor(element: HTMLElement): LayoutDirectiveState {
	let state = states.get(element);
	if (state == null) {
		state = { from: null, handle: null, cancelRead: null, cancelWrite: null };
		states.set(element, state);
	}
	return state;
}

function enabled(value: LayoutDirectiveValue): boolean {
	return value !== false;
}

function optionsFor(value: LayoutDirectiveValue): LayoutMotionOptions {
	return typeof value === 'object' && value != null ? value : {};
}

export const motionLayoutDirective: Directive<HTMLElement, LayoutDirectiveValue> = {
	mounted(element) {
		stateFor(element);
	},
	beforeUpdate(element, binding) {
		if (!enabled(binding.value)) return;
		const state = stateFor(element);
		state.cancelRead?.();
		state.cancelWrite?.();
		state.cancelRead = null;
		state.cancelWrite = null;
		state.from = captureLayout(element);
		state.handle?.cancel();
		state.handle = null;
	},
	updated(element, binding) {
		if (!enabled(binding.value)) return;
		const state = stateFor(element);
		const from = state.from;
		if (from == null) return;
		state.cancelRead = motionScheduler.scheduleRead(() => {
			state.cancelRead = null;
			const to = captureLayout(element);
			state.cancelWrite = motionScheduler.scheduleWrite(() => {
				state.cancelWrite = null;
				state.handle = animateLayoutChange(element, from, to, optionsFor(binding.value));
				state.from = null;
			});
		});
	},
	unmounted(element) {
		const state = states.get(element);
		state?.cancelRead?.();
		state?.cancelWrite?.();
		state?.handle?.cancel();
		states.delete(element);
	},
};
