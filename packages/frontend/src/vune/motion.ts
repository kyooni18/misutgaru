/* SPDX-License-Identifier: AGPL-3.0-only */
import { Animation as VuneAnimation } from 'vune-ui';
import {
	curves,
	defaultEngine,
	MotionEngine,
	motionValue,
	spring,
	timing,
} from 'o0o0o';
import type { AnimationControls, MotionSpec } from 'o0o0o';

export type MotionStatus = 'finished' | 'cancelled';
export type MotionUpdate = (progress: number) => void;

export type MotionOptions = {
	animation?: VuneAnimation | null;
	reducedMotion?: 'respect' | 'ignore';
	onUpdate: MotionUpdate;
	onComplete?: (status: MotionStatus) => void;
};

export type ElementMotionOptions = {
	animation?: VuneAnimation | null;
	reducedMotion?: 'respect' | 'ignore';
	fill?: FillMode;
	composite?: CompositeOperation;
};

export type MotionHandle = {
	readonly finished: Promise<MotionStatus>;
	cancel(): void;
};

type AnimationTiming = {
	durationMs: number;
	delayMs: number;
	repeatCount: number;
	autoreverses: boolean;
};

// Use Vune's shared scheduler for normal work. The opt-out lane only needs a
// second engine because o0o0o's default engine enforces reduced motion itself.
const sharedMotionEngine = defaultEngine;
const unrestrictedMotionEngine = new MotionEngine({ respectReducedMotion: false });

function reducedMotionRequested(): boolean {
	return typeof window !== 'undefined'
		&& typeof window.matchMedia === 'function'
		&& window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function reportMotionCallbackError(kind: 'update' | 'complete', error: unknown): void {
	console.error(`[VuneMotion] ${kind} failed`, error);
}

function settleImmediate(options: MotionOptions, progress: number): MotionStatus {
	let status: MotionStatus = 'finished';
	try {
		options.onUpdate(progress);
	} catch (error) {
		status = 'cancelled';
		reportMotionCallbackError('update', error);
	}
	try {
		options.onComplete?.(status);
	} catch (error) {
		reportMotionCallbackError('complete', error);
	}
	return status;
}

function animationTiming(animation: VuneAnimation): AnimationTiming {
	const descriptor = animation.descriptor;
	const speed = Number.isFinite(descriptor.speed) && descriptor.speed > 0 ? descriptor.speed : 1;
	return {
		durationMs: Math.max(0, descriptor.duration * 1000 / speed),
		delayMs: Math.max(0, descriptor.delay * 1000 / speed),
		repeatCount: descriptor.repeatCount == null
			? 1
			: descriptor.repeatCount === Number.POSITIVE_INFINITY
				? Number.POSITIVE_INFINITY
				: Math.max(1, Math.floor(descriptor.repeatCount)),
		autoreverses: descriptor.autoreverses ?? false,
	};
}

function motionSpecForAnimation(animation: VuneAnimation): MotionSpec {
	const descriptor = animation.descriptor;
	const speed = Number.isFinite(descriptor.speed) && descriptor.speed > 0 ? descriptor.speed : 1;
	if (descriptor.kind === 'spring') {
		return spring({
			response: Math.max(0.001, (descriptor.response ?? descriptor.duration) / speed),
			dampingRatio: descriptor.dampingFraction ?? 0.825,
		});
	}

	const curve = descriptor.kind === 'linear'
		? curves.linear
		: descriptor.kind === 'easeIn'
			? curves.easeIn
			: descriptor.kind === 'easeOut'
				? curves.easeOut
				: curves.easeInOut;
	return timing({ duration: Math.max(0, descriptor.duration / speed), curve });
}

function waapiEasing(animation: VuneAnimation): string {
	switch (animation.descriptor.kind) {
		case 'linear': return 'linear';
		case 'easeIn': return 'cubic-bezier(0.42, 0, 1, 1)';
		case 'easeOut': return 'cubic-bezier(0, 0, 0.58, 1)';
		case 'spring': return 'cubic-bezier(0.22, 1, 0.36, 1)';
		case 'easeInOut':
		default: return 'cubic-bezier(0.42, 0, 0.58, 1)';
	}
}

/**
 * Application adapter for Vune's renderer-independent animation value.
 *
 * The actual clock/interpolator is now Vune's o0o0o engine. Keeping this
 * adapter here lets Vue consumers retain the old promise/cancel contract while
 * numeric, spring, color, and transform animations share the same scheduler as
 * the updated Vune web renderer.
 */
export class VuneMotionEngine {
	private readonly activeCancels = new Set<() => void>();
	private readonly elementAnimations = new Set<Animation>();

	public animate(options: MotionOptions): MotionHandle {
		const animation = options.animation ?? VuneAnimation.default;
		const { durationMs, delayMs, repeatCount, autoreverses } = animationTiming(animation);
		let resolveFinished!: (status: MotionStatus) => void;
		const finished = new Promise<MotionStatus>(resolve => { resolveFinished = resolve; });

		if ((options.reducedMotion ?? 'respect') === 'respect' && reducedMotionRequested()) {
			resolveFinished(settleImmediate(options, 1));
			return { finished, cancel() {} };
		}
		if (durationMs === 0) {
			resolveFinished(settleImmediate(options, 1));
			return { finished, cancel() {} };
		}

		const value = motionValue(0);
		const spec = motionSpecForAnimation(animation);
		let settled = false;
		let cycle = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let control: AnimationControls | null = null;
		let unsubscribe = () => {};

		const finish = (status: MotionStatus): void => {
			if (settled) return;
			settled = true;
			if (timer !== null) globalThis.clearTimeout(timer);
			timer = null;
			unsubscribe();
			this.activeCancels.delete(cancel);
			try {
				options.onComplete?.(status);
			} catch (error) {
				reportMotionCallbackError('complete', error);
			}
			resolveFinished(status);
		};

		const cancel = (): void => {
			if (settled) return;
			if (timer !== null) globalThis.clearTimeout(timer);
			timer = null;
			control?.cancel();
			finish('cancelled');
		};
		this.activeCancels.add(cancel);

		let callbackFailed = false;
		unsubscribe = value.subscribe(progress => {
			try {
				options.onUpdate(progress);
			} catch (error) {
				callbackFailed = true;
				reportMotionCallbackError('update', error);
				control?.cancel();
				finish('cancelled');
			}
		}, { emitCurrent: false });

		const startCycle = (): void => {
			if (settled || callbackFailed) return;
			const start = autoreverses && cycle % 2 === 1 ? 1 : 0;
			const target = start === 0 ? 1 : 0;
			value.set(start);
			if (!this.activeCancels.has(cancel)) return;
			try {
				const motionEngine = options.reducedMotion === 'ignore' ? unrestrictedMotionEngine : sharedMotionEngine;
				control = motionEngine.animate(value, target, spec);
			} catch (error) {
				reportMotionCallbackError('update', error);
				finish('cancelled');
				return;
			}
			void control.finished.then(result => {
				if (settled || callbackFailed) return;
				if (result.status !== 'finished') {
					finish('cancelled');
					return;
				}
				if (repeatCount === Number.POSITIVE_INFINITY || cycle + 1 < repeatCount) {
					cycle += 1;
					startCycle();
				} else {
					finish('finished');
				}
			}).catch(error => {
				reportMotionCallbackError('update', error);
				finish('cancelled');
			});
		};

		if (delayMs > 0) timer = globalThis.setTimeout(startCycle, delayMs);
		else startCycle();

		return { finished, cancel };
	}

	public animateNumber(
		from: number,
		to: number,
		animation: VuneAnimation | null | undefined,
		onUpdate: (value: number) => void,
	): MotionHandle {
		return this.animate({
			animation,
			onUpdate: progress => onUpdate(from + ((to - from) * progress)),
		});
	}

	/**
	 * WAAPI escape hatch for fixed keyframes. Vune's o0o0o engine owns numeric
	 * and interpolated style values; keyframes remain browser-compositor work.
	 */
	public animateElement(
		element: Element,
		keyframes: Keyframe[] | PropertyIndexedKeyframes,
		options: ElementMotionOptions = {},
	): MotionHandle {
		const animation = options.animation ?? VuneAnimation.default;
		const { durationMs, delayMs, repeatCount, autoreverses } = animationTiming(animation);
		let resolveFinished!: (status: MotionStatus) => void;
		const finished = new Promise<MotionStatus>(resolve => { resolveFinished = resolve; });
		const reduced = (options.reducedMotion ?? 'respect') === 'respect' && reducedMotionRequested();

		if (reduced || typeof element.animate !== 'function' || durationMs === 0) {
			resolveFinished('finished');
			return { finished, cancel() {} };
		}

		let native: Animation;
		try {
			native = element.animate(keyframes, {
				duration: durationMs,
				delay: delayMs,
				iterations: repeatCount,
				direction: autoreverses ? 'alternate' : 'normal',
				easing: waapiEasing(animation),
				fill: options.fill ?? 'both',
				composite: options.composite ?? 'replace',
			});
		} catch (error) {
			console.error('[VuneMotion] element animation failed', error);
			resolveFinished('cancelled');
			return { finished, cancel() {} };
		}

		this.elementAnimations.add(native);
		let settled = false;
		const settle = (status: MotionStatus): void => {
			if (settled) return;
			settled = true;
			this.elementAnimations.delete(native);
			resolveFinished(status);
		};
		void native.finished.then(() => settle('finished')).catch(() => settle('cancelled'));

		return {
			finished,
			cancel: () => {
				if (settled) return;
				native.cancel();
				settle('cancelled');
			},
		};
	}

	public cancelAll(): void {
		for (const cancel of [...this.activeCancels]) cancel();
		for (const animation of [...this.elementAnimations]) animation.cancel();
		this.elementAnimations.clear();
	}
}

export const vuneMotion = new VuneMotionEngine();
