/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { motion } from '@/motion/index.js';
import type { MotionHandle, MotionPresetName } from '@/motion/index.js';

export type ContextMenuMotionPhase = 'enter' | 'leave';

function presetForPhase(phase: ContextMenuMotionPhase): MotionPresetName {
	return phase === 'enter' ? 'surfaceEnter' : 'surfaceLeave';
}

export function contextMenuRootKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const hidden: Keyframe = { opacity: 0, scale: 0.92 };
	const visible: Keyframe = { opacity: 1, scale: 1 };
	return phase === 'enter' ? [hidden, visible] : [visible, hidden];
}

export function contextMenuDrawerKeyframes(phase: ContextMenuMotionPhase): Keyframe[] {
	const hidden: Keyframe = { opacity: 0.96, translate: '0 100%' };
	const visible: Keyframe = { opacity: 1, translate: '0 0' };
	return phase === 'enter' ? [hidden, visible] : [visible, hidden];
}

export function animateElementTransition(
	element: Element,
	keyframes: Keyframe[],
	phase: ContextMenuMotionPhase,
	done?: () => void,
	preset: MotionPresetName = presetForPhase(phase),
): MotionHandle {
	const handle = motion.animate(element, keyframes, {
		preset,
		category: 'spatial',
	});
	if (done) void handle.finished.then(() => done());
	return handle;
}

export function animateContextMenuTransition(
	element: Element,
	phase: ContextMenuMotionPhase,
	done: () => void,
	animatedElement: Element = element,
	keyframes: Keyframe[] = contextMenuRootKeyframes(phase),
): void {
	animateElementTransition(animatedElement, keyframes, phase, done);
}
