/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { animateVuneTransition, surfaceMotionAnimation, uiMotion } from '@/vune/motion.js';

export type ContextMenuMotionPhase = 'enter' | 'leave';

export const contextMenuScaleProperty = '--mk-context-menu-scale';

export const contextMenuAnimation = uiMotion.surfaceEnter;

export function contextMenuAnimationForPhase(phase: ContextMenuMotionPhase) {
	return surfaceMotionAnimation(phase);
}

/**
 * Keep menu geometry on its own scale track. The leave fade hides the element
 * before Vue removes it, while MaterialSurface owns its backing-layer track.
 */
export function contextMenuRootKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const hidden = {
		[contextMenuScaleProperty]: 0.9,
	};
	const visible = {
		[contextMenuScaleProperty]: 1,
	};

	if (phase === 'enter') return [hidden, visible];
	return [
		{ ...visible, opacity: 1 },
		{ ...hidden, opacity: 0 },
	];
}

/** Content-level variant for modal popups whose root also owns the backdrop. */
export function contextMenuContentKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const hidden = { transform: 'scale(0.9)' };
	const visible = { transform: 'scale(1)' };
	return phase === 'enter' ? [hidden, visible] : [visible, hidden];
}

export function contextMenuDrawerKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const hidden = { transform: 'translateY(100%)' };
	const visible = { transform: 'translateY(0)' };
	return phase === 'enter' ? [hidden, visible] : [visible, hidden];
}

function contextMenuOpaqueKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const opaque = { opacity: 1 };
	const transparent = { opacity: 0 };
	return phase === 'enter' ? [opaque, transparent] : [transparent, opaque];
}

export function animateContextMenuTransition(
	element: Element,
	phase: ContextMenuMotionPhase,
	done: () => void,
	animatedElement: Element = element,
	keyframes: Keyframe[] = contextMenuRootKeyframes(phase),
): void {
	const handles = [
		animateVuneTransition(animatedElement, keyframes, contextMenuAnimationForPhase(phase), () => {}),
	];

	// MaterialSurface's enter animation is CSS-driven, but closing must restore
	// the opaque backing layer while the menu collapses.
	if (phase === 'leave') {
		for (const opaque of animatedElement.querySelectorAll<HTMLElement>('.vune-material__opaque')) {
			handles.push(animateVuneTransition(opaque, contextMenuOpaqueKeyframes(phase), contextMenuAnimationForPhase(phase), () => {}));
		}
	}

	void Promise.all(handles.map(handle => handle.finished)).then(done, done);
}
