/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { motionPresets } from './tokens.js';
import type { MotionCategory, MotionPresetName, ResolvedMotionPreset } from './types.js';

export interface MotionPolicyState {
	userEnabled: boolean;
	reducedMotion: boolean;
	documentVisible: boolean;
}

const DEFAULT_STATE: MotionPolicyState = {
	userEnabled: true,
	reducedMotion: false,
	documentVisible: true,
};

export class MotionPolicy {
	private state: MotionPolicyState = { ...DEFAULT_STATE };

	public configure(next: Partial<MotionPolicyState>): void {
		this.state = { ...this.state, ...next };
	}

	public snapshot(): Readonly<MotionPolicyState> {
		return { ...this.state };
	}

	public resolve(
		presetName: MotionPresetName,
		category: MotionCategory,
		overrides: { duration?: number; easing?: string } = {},
	): ResolvedMotionPreset {
		const preset = motionPresets[presetName];
		const duration = overrides.duration ?? preset.duration;
		const easing = overrides.easing ?? preset.easing;

		if (!this.state.userEnabled || !this.state.documentVisible) {
			return { duration: 0, easing, disabled: true, reduced: this.state.reducedMotion };
		}

		if (!this.state.reducedMotion) {
			return { duration, easing, disabled: duration <= 0, reduced: false };
		}

		if (category === 'decorative') {
			return { duration: 0, easing, disabled: true, reduced: true };
		}

		const reducedDuration = category === 'spatial'
			? Math.min(duration, 120)
			: category === 'functional'
				? Math.min(duration, 100)
				: Math.min(duration, 140);

		return {
			duration: reducedDuration,
			easing,
			disabled: reducedDuration <= 0,
			reduced: true,
		};
	}
}

export const motionPolicy = new MotionPolicy();
