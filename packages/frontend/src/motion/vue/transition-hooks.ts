/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MotionAnimateOptions, MotionKeyframes } from '../core/index.js';
import { useMotion } from './use-motion.js';

export interface MotionTransitionSpec {
	keyframes: MotionKeyframes | ((element: Element) => MotionKeyframes);
	options?: MotionAnimateOptions;
}

export function useMotionTransition(config: { enter: MotionTransitionSpec; leave: MotionTransitionSpec }) {
	const motion = useMotion();
	const run = (element: Element, done: () => void, spec: MotionTransitionSpec) => {
		const keyframes = typeof spec.keyframes === 'function' ? spec.keyframes(element) : spec.keyframes;
		const handle = motion.animate(element, keyframes, spec.options);
		void handle.finished.then(() => done());
	};
	return {
		enter: (element: Element, done: () => void) => run(element, done, config.enter),
		leave: (element: Element, done: () => void) => run(element, done, config.leave),
	};
}
