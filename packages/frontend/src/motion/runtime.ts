/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { watch } from 'vue';
import { prefer } from '@/preferences.js';
import { installMotionCssVariables, motionPolicy } from './core/index.js';

let initialized = false;

export function initializeMotionRuntime(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const syncPolicy = () => {
		const userEnabled = prefer.s.animation;
		const isReducedMotion = reducedMotion.matches;
		motionPolicy.configure({
			userEnabled,
			reducedMotion: isReducedMotion,
			documentVisible: window.document.visibilityState === 'visible',
		});
		installMotionCssVariables(window.document.documentElement, {
			enabled: userEnabled,
			reducedMotion: isReducedMotion,
		});
	};

	syncPolicy();
	watch(prefer.r.animation, syncPolicy);
	reducedMotion.addEventListener('change', syncPolicy);
	window.document.addEventListener('visibilitychange', syncPolicy);
}
