/* SPDX-License-Identifier: AGPL-3.0-only */
/**
 * Misutgaru compatibility surface. Motion execution lives in @vune-ui/web so
 * Vue transitions and native Vune Views share one scheduler and interpolator.
 */
import { Animation } from 'vune-ui';
import { animateVuneTransition as runVuneTransition } from '@vune-ui/web/motion';

export type SurfaceMotionPhase = 'enter' | 'leave';

/**
 * Product-level motion vocabulary. Components should select a semantic track
 * from here instead of introducing another duration/easing pair.
 */
export const uiMotion = Object.freeze({
	surfaceEnter: Animation.spring(0.24, 0.9),
	surfaceLeave: Animation.easeIn(0.16),
	drawer: Animation.spring(0.3, 0.9),
	backdrop: Animation.easeInOut(0.2),
	feedback: Animation.spring(0.16, 0.68),
});

export function surfaceMotionAnimation(phase: SurfaceMotionPhase): Animation {
	return phase === 'enter' ? uiMotion.surfaceEnter : uiMotion.surfaceLeave;
}

export function surfaceScaleKeyframes(
	phase: SurfaceMotionPhase,
	scale = 0.96,
	fade = true,
): Keyframe[] {
	const hidden: Keyframe = {
		...(fade ? { opacity: 0 } : {}),
		transform: `scale(${scale})`,
	};
	const visible: Keyframe = {
		...(fade ? { opacity: 1 } : {}),
		transform: 'scale(1)',
	};
	return phase === 'enter' ? [hidden, visible] : [visible, hidden];
}

export function animateSurfaceTransition(
	element: Element,
	phase: SurfaceMotionPhase,
	done: () => void,
	options: { scale?: number; fade?: boolean } = {},
) {
	return runVuneTransition(
		element,
		surfaceScaleKeyframes(phase, options.scale, options.fade),
		surfaceMotionAnimation(phase),
		done,
	);
}

export {
	VuneMotionEngine,
	vuneMotion,
	animateVuneTransition,
	type MotionStatus,
	type MotionUpdate,
	type MotionOptions,
	type ElementMotionOptions,
	type MotionHandle,
} from '@vune-ui/web/motion';
