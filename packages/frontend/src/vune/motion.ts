/* SPDX-License-Identifier: AGPL-3.0-only */
/**
 * Misutgaru compatibility surface. Motion execution lives in @vune-ui/web so
 * Vue transitions and native Vune Views share one scheduler and interpolator.
 */
export {
	VuneMotionEngine,
	vuneMotion,
	animateVuneTransition,
	type MotionStatus,
	type MotionUpdate,
	type MotionOptions,
	type ElementMotionOptions,
	type MotionHandle,
} from '@vune-ui/web';
