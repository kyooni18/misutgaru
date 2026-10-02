/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export { animateMotion, motionPropertiesFromKeyframes } from './animation.js';
export { MotionActivityController, type MotionActivityOptions, type MotionActivitySubscriber } from './activity.js';
export { bindMotionStyle } from './bind.js';
export { browserMotionClock, type MotionClock } from './clock.js';
export { dragGesture, type DragAxis, type DragConstraints, type DragGestureHandle, type DragGestureOptions, type DragGestureState } from './gesture.js';
export { inertiaMotionValue, type InertiaMotionHandle, type InertiaMotionOptions, type MotionBounds } from './inertia.js';
export { animateLayoutChange, captureLayout, type LayoutMotionOptions, type LayoutSnapshot } from './layout.js';
export { MotionValue, type MotionValueSubscriber } from './motion-value.js';
export { motionPolicy, MotionPolicy, type MotionPolicyState } from './policy.js';
export { MotionScheduler, motionScheduler } from './scheduler.js';
export { MotionScope } from './scope.js';
export { springMotionValue, springPresets, type MotionValueHandle, type SpringDefinition, type SpringMotionOptions, type SpringPresetName } from './spring.js';
export { parallelMotion, sequenceMotion, staggerMotion, timelineMotion, type MotionFactory, type MotionTimelineEntry, type MotionTimelineHandle, type MotionTimelineOptions } from './timeline.js';
export { installMotionCssVariables, motionPresets, type MotionCssPolicy } from './tokens.js';
export type {
	MotionAnimateOptions,
	MotionCategory,
	MotionHandle,
	MotionKeyframes,
	MotionPreset,
	MotionPresetName,
	MotionPlaybackHandle,
	MotionRetargetOptions,
	MotionScopeLike,
	MotionStatus,
	ResolvedMotionPreset,
} from './types.js';
