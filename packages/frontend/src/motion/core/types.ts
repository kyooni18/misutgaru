/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type MotionCategory = 'essential' | 'functional' | 'decorative' | 'spatial';
export type MotionStatus = 'idle' | 'running' | 'paused' | 'finished' | 'cancelled';
export type MotionPresetName = 'instant' | 'feedback' | 'control' | 'surfaceEnter' | 'surfaceLeave' | 'drawer' | 'navigation' | 'layout' | 'backdrop' | 'emphasized';
export type MotionKeyframes = Keyframe[] | PropertyIndexedKeyframes;

export interface MotionPreset {
	duration: number;
	easing: string;
}

export interface ResolvedMotionPreset extends MotionPreset {
	disabled: boolean;
	reduced: boolean;
}

export interface MotionPlaybackHandle {
	readonly status: MotionStatus;
	readonly finished: Promise<MotionStatus>;
	cancel(): void;
	finish(): void;
	pause(): void;
	play(): void;
	reverse(): void;
}

export interface MotionScopeLike {
	track(handle: MotionPlaybackHandle): void;
}

export interface MotionAnimateOptions extends Omit<KeyframeAnimationOptions, 'duration' | 'easing'> {
	preset?: MotionPresetName;
	category?: MotionCategory;
	duration?: number;
	easing?: string;
	properties?: readonly string[];
	scope?: MotionScopeLike;
}

export type MotionRetargetOptions = Partial<MotionAnimateOptions>;

export interface MotionHandle extends MotionPlaybackHandle {
	retarget(keyframes: MotionKeyframes, options?: MotionRetargetOptions): void;
}
