/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MotionPreset, MotionPresetName } from './types.js';

export const motionPresets = Object.freeze<Record<MotionPresetName, MotionPreset>>({
	instant: { duration: 0, easing: 'linear' },
	feedback: { duration: 120, easing: 'cubic-bezier(.2,.8,.2,1)' },
	control: { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
	surfaceEnter: { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
	surfaceLeave: { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' },
	drawer: { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
	navigation: { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
	layout: { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' },
	backdrop: { duration: 200, easing: 'cubic-bezier(.4,0,.2,1)' },
	emphasized: { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' },
});

export interface MotionCssPolicy {
	enabled: boolean;
	reducedMotion: boolean;
}

const cssVariables = Object.freeze({
	'--MI-motion-duration-instant': `${motionPresets.instant.duration}ms`,
	'--MI-motion-duration-feedback': `${motionPresets.feedback.duration}ms`,
	'--MI-motion-duration-control': `${motionPresets.control.duration}ms`,
	'--MI-motion-duration-layout': `${motionPresets.layout.duration}ms`,
	'--MI-motion-duration-surface-enter': `${motionPresets.surfaceEnter.duration}ms`,
	'--MI-motion-duration-surface-leave': `${motionPresets.surfaceLeave.duration}ms`,
	'--MI-motion-duration-fast': `${motionPresets.feedback.duration}ms`,
	'--MI-motion-duration-standard': `${motionPresets.layout.duration}ms`,
	'--MI-motion-duration-slow': `${motionPresets.emphasized.duration}ms`,
	'--MI-motion-ease-standard': motionPresets.control.easing,
	'--MI-motion-ease-emphasized': motionPresets.emphasized.easing,
	'--MI-motion-ease-exit': motionPresets.surfaceLeave.easing,
});

export function installMotionCssVariables(
	root: HTMLElement = window.document.documentElement,
	policy: MotionCssPolicy = { enabled: true, reducedMotion: false },
): void {
	const suppressDurations = !policy.enabled || policy.reducedMotion;
	for (const [name, value] of Object.entries(cssVariables)) {
		root.style.setProperty(name, suppressDurations && name.includes('-duration-') ? '0ms' : value);
	}
}
