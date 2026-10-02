/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { animateMotion } from '../core/index.js';
import type { MotionAnimateOptions, MotionHandle, MotionKeyframes } from '../core/index.js';
import { useMotionScope } from './use-motion-scope.js';

export function useMotion() {
	const scope = useMotionScope();
	return {
		scope,
		animate(element: Element, keyframes: MotionKeyframes, options: MotionAnimateOptions = {}): MotionHandle {
			return animateMotion(element, keyframes, { ...options, scope });
		},
	};
}
