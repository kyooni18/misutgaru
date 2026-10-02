/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { animateLayoutChange, animateMotion, bindMotionStyle, dragGesture, inertiaMotionValue, MotionValue, motionPolicy, motionScheduler, parallelMotion, sequenceMotion, springMotionValue, staggerMotion, timelineMotion } from './core/index.js';
import { initializeMotionRuntime } from './runtime.js';

export const motion = Object.freeze({
	animate: animateMotion,
	layout: animateLayoutChange,
	value: <T>(initialValue: T) => new MotionValue(initialValue),
	bindStyle: bindMotionStyle,
	spring: springMotionValue,
	inertia: inertiaMotionValue,
	drag: dragGesture,
	timeline: timelineMotion,
	parallel: parallelMotion,
	sequence: sequenceMotion,
	stagger: staggerMotion,
	policy: motionPolicy,
	scheduler: motionScheduler,
});

export { initializeMotionRuntime };
export * from './core/index.js';
export * from './vue/index.js';
