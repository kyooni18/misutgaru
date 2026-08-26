/* SPDX-License-Identifier: AGPL-3.0-only */
import { Animation as VuneAnimation } from 'vune-ui';
import {
	animateInterpolated,
	curves,
	createInterpolator,
	defaultEngine,
	MotionEngine,
	motionValue,
	spring,
	timing,
} from 'o0o0o';
import type { AnimationControls, InterpolatorOptions, MotionSpec } from 'o0o0o';

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

type InterpolatedKeyframe = {
	property: string;
	cssProperty: string;
	from: unknown;
	to: unknown;
	options: InterpolatorOptions;
};

const keyframeMetadata = new Set([
	'offset',
	'easing',
	'composite',
	'computedOffset',
	'timeline',
	'rangeStart',
	'rangeEnd',
]);

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

function cssPropertyName(property: string): string {
	return property.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
}

function styleOf(element: Element): CSSStyleDeclaration | undefined {
	return (element as Element & { style?: CSSStyleDeclaration }).style;
}

function isColorProperty(property: string): boolean {
	return property === 'color'
		|| property === 'background'
		|| property === 'backgroundColor'
		|| property === 'borderColor'
		|| property.endsWith('Color');
}

function cssNumberInterpolator(from: unknown, to: unknown): InterpolatorOptions | undefined {
	const left = String(from).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(.*)$/);
	const right = String(to).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(.*)$/);
	if (!left || !right || left[2] !== right[2]) return undefined;
	const start = Number(left[1]);
	const end = Number(right[1]);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
	return {
		interpolate: (_from, _to, progress) => `${start + ((end - start) * progress)}${left[2]}`,
	};
}

function interpolationOptions(property: string, from: unknown, to: unknown): InterpolatorOptions | undefined {
	let options: InterpolatorOptions | undefined;
	if (property === 'transform' && typeof from === 'string' && typeof to === 'string') {
		options = { type: 'transform' };
	} else if (isColorProperty(property) && typeof from === 'string' && typeof to === 'string') {
		options = { type: 'color', color: { space: 'oklab' } };
	} else if (typeof from === 'number' && typeof to === 'number') {
		options = {};
	} else {
		options = cssNumberInterpolator(from, to);
		if (!options) {
			try {
				createInterpolator(from, to);
				return {};
			} catch {
				return undefined;
			}
		}
	}
	try {
		createInterpolator(from, to, options);
		return options;
	} catch {
		return undefined;
	}
}

function interpolatedKeyframes(keyframes: Keyframe[] | PropertyIndexedKeyframes): InterpolatedKeyframe[] | undefined {
	if (!Array.isArray(keyframes) || keyframes.length !== 2) return undefined;
	const [first, last] = keyframes;
	if (!first || !last) return undefined;
	const properties = new Set([
		...Object.keys(first).filter(property => !keyframeMetadata.has(property)),
		...Object.keys(last).filter(property => !keyframeMetadata.has(property)),
	]);
	if (properties.size === 0) return undefined;

	const result: InterpolatedKeyframe[] = [];
	for (const property of properties) {
		const from = first[property as keyof Keyframe];
		const to = last[property as keyof Keyframe];
		if (from === undefined || from === null || to === undefined || to === null) return undefined;
		const options = interpolationOptions(property, from, to);
		if (!options) return undefined;
		result.push({ property, cssProperty: cssPropertyName(property), from, to, options });
	}
	return result;
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
	private readonly elementCancels = new Set<() => void>();
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
		unsubscribe = value.subscribeValue(progress => {
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

	private animateInterpolatedElement(
		element: Element,
		keyframes: Keyframe[] | PropertyIndexedKeyframes,
		animation: VuneAnimation,
		options: ElementMotionOptions,
		reduced: boolean,
	): MotionHandle | undefined {
		const entries = interpolatedKeyframes(keyframes);
		const style = styleOf(element);
		if (!entries || !style) return undefined;
		if (options.composite !== undefined && options.composite !== 'replace') return undefined;

		const { durationMs, delayMs, repeatCount, autoreverses } = animationTiming(animation);
		let resolveFinished!: (status: MotionStatus) => void;
		const finished = new Promise<MotionStatus>(resolve => { resolveFinished = resolve; });
		let settled = false;
		let cycle = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let currentControls: AnimationControls[] = [];

		const restoreInitialValues = (): void => {
			if (options.fill !== 'none' && options.fill !== 'backwards') return;
			for (const entry of entries) style.setProperty(entry.cssProperty, String(entry.from));
		};

		const finish = (status: MotionStatus): void => {
			if (settled) return;
			settled = true;
			if (timer !== null) globalThis.clearTimeout(timer);
			timer = null;
			if (status === 'finished' && durationMs > 0) restoreInitialValues();
			this.elementCancels.delete(cancel);
			resolveFinished(status);
		};

		const cancel = (): void => {
			if (settled) return;
			if (timer !== null) globalThis.clearTimeout(timer);
			timer = null;
			for (const control of currentControls) control.cancel();
			finish('cancelled');
		};
		this.elementCancels.add(cancel);

		if (reduced || durationMs === 0) {
			for (const entry of entries) style.setProperty(entry.cssProperty, String(entry.to));
			finish('finished');
			return { finished, cancel };
		}

		const startCycle = (): void => {
			if (settled) return;
			const reverse = autoreverses && cycle % 2 === 1;
			const motionEngine = options.reducedMotion === 'ignore' ? unrestrictedMotionEngine : sharedMotionEngine;
			const cycleControls: AnimationControls[] = [];
			currentControls = cycleControls;
			try {
				for (const entry of entries) {
					const from = reverse ? entry.to : entry.from;
					const to = reverse ? entry.from : entry.to;
					cycleControls.push(animateInterpolated(
						from,
						to,
						motionSpecForAnimation(animation),
						value => style.setProperty(entry.cssProperty, String(value)),
						{ engine: motionEngine, ...entry.options },
					));
				}
			} catch (error) {
				reportMotionCallbackError('update', error);
				for (const control of cycleControls) control.cancel();
				finish('cancelled');
				return;
			}

			void Promise.all(cycleControls.map(control => control.finished)).then(results => {
				if (settled) return;
				if (results.some(result => result.status !== 'finished')) {
					finish('cancelled');
					return;
				}
				if (repeatCount === Number.POSITIVE_INFINITY || cycle + 1 < repeatCount) {
					cycle += 1;
					startCycle();
					return;
				}
				finish('finished');
			}).catch(error => {
				reportMotionCallbackError('update', error);
				finish('cancelled');
			});
		};

		if (delayMs > 0) {
			if (options.fill === 'both' || options.fill === 'backwards') {
				for (const entry of entries) style.setProperty(entry.cssProperty, String(entry.from));
			}
			timer = globalThis.setTimeout(startCycle, delayMs);
		} else {
			startCycle();
		}

		return { finished, cancel };
	}

	/**
	 * Animate a pair of style keyframes through o0o0o's shared interpolator.
	 * Unsupported keyframe shapes fall back to the browser compositor below.
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
		const interpolated = this.animateInterpolatedElement(element, keyframes, animation, options, reduced);
		if (interpolated) return interpolated;

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
			this.elementCancels.delete(cancel);
			resolveFinished(status);
		};
		const cancel = (): void => {
			if (settled) return;
			native.cancel();
			settle('cancelled');
		};
		this.elementCancels.add(cancel);
		void native.finished.then(() => settle('finished')).catch(() => settle('cancelled'));

		return {
			finished,
			cancel,
		};
	}

	public cancelAll(): void {
		for (const cancel of [...this.activeCancels]) cancel();
		for (const cancel of [...this.elementCancels]) cancel();
		for (const animation of [...this.elementAnimations]) animation.cancel();
		this.elementAnimations.clear();
	}
}

export const vuneMotion = new VuneMotionEngine();
