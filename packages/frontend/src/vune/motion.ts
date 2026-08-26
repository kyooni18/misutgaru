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
	cssProperty: string;
	first: unknown;
	last: unknown;
	segments: Array<{
		from: unknown;
		to: unknown;
		options: InterpolatorOptions;
		durationScale: number;
	}>;
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
	if (property.startsWith('--') || property.includes('-')) return property;
	return property.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
}

function styleOf(element: Element): CSSStyleDeclaration | undefined {
	return (element as Element & { style?: CSSStyleDeclaration }).style;
}

function isColorProperty(property: string): boolean {
	const cssProperty = cssPropertyName(property).toLowerCase();
	return cssProperty === 'color'
		|| cssProperty === 'background'
		|| cssProperty === 'background-color'
		|| cssProperty === 'border-color'
		|| cssProperty.endsWith('-color');
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
	if (cssPropertyName(property) === 'transform' && typeof from === 'string' && typeof to === 'string') {
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
	if (!Array.isArray(keyframes) || keyframes.length < 2) return undefined;
	const frames = keyframes as Keyframe[];
	// Segment-specific easing and compositing cannot be represented by one
	// o0o0o MotionSpec. Keep those keyframes on the browser compositor so the
	// original WAAPI semantics remain intact.
	if (frames.some(frame => frame.easing !== undefined && frame.easing !== null)
		|| frames.some(frame => frame.composite !== undefined && frame.composite !== null && frame.composite !== 'replace')) {
		return undefined;
	}
	const properties = new Set([
		...frames.flatMap(frame => Object.keys(frame).filter(property => !keyframeMetadata.has(property))),
	]);
	if (properties.size === 0) return undefined;

	const rawOffsets = frames.map(frame => frame.offset);
	const hasOffsets = rawOffsets.some(offset => offset !== null && offset !== undefined);
	if (hasOffsets && rawOffsets.some(offset => typeof offset !== 'number' || !Number.isFinite(offset))) return undefined;
	const offsets = hasOffsets
		? rawOffsets as number[]
		: frames.map((_frame, index) => index / (frames.length - 1));
	if (offsets.some((offset, index) => offset < 0 || offset > 1 || (index > 0 && offset < offsets[index - 1]))) return undefined;

	const result: InterpolatedKeyframe[] = [];
	for (const property of properties) {
		const values = frames.map(frame => (frame as Record<string, unknown>)[property]);
		if (values.some(value => value === undefined || value === null)) return undefined;
		const segments: InterpolatedKeyframe['segments'] = [];
		for (let index = 0; index < values.length - 1; index++) {
			const from = values[index];
			const to = values[index + 1];
			const options = interpolationOptions(property, from, to);
			if (!options) return undefined;
			segments.push({ from, to, options, durationScale: offsets[index + 1] - offsets[index] });
		}
		result.push({ cssProperty: cssPropertyName(property), first: values[0], last: values.at(-1), segments });
	}
	return result;
}

function keyframeProperties(keyframes: Keyframe[] | PropertyIndexedKeyframes): string[] {
	const properties = Array.isArray(keyframes)
		? keyframes.flatMap(frame => Object.keys(frame))
		: Object.keys(keyframes);
	return [...new Set(properties
		.filter(property => !keyframeMetadata.has(property))
		.map(cssPropertyName))];
}

function finalKeyframeIsReverse(repeatCount: number, autoreverses: boolean): boolean {
	return autoreverses
		&& Number.isFinite(repeatCount)
		&& repeatCount > 1
		&& repeatCount % 2 === 0;
}

function applyFinalKeyframe(
	element: Element,
	keyframes: Keyframe[] | PropertyIndexedKeyframes,
	reverse: boolean,
): void {
	const style = styleOf(element);
	if (!style) return;

	if (Array.isArray(keyframes)) {
		const frame = keyframes[reverse ? 0 : keyframes.length - 1];
		if (!frame) return;
		for (const [property, value] of Object.entries(frame)) {
			if (keyframeMetadata.has(property) || value === undefined || value === null) continue;
			style.setProperty(cssPropertyName(property), String(value));
		}
		return;
	}

	for (const [property, value] of Object.entries(keyframes)) {
		if (keyframeMetadata.has(property) || value === undefined || value === null) continue;
		const finalValue = Array.isArray(value)
			? value[reverse ? 0 : value.length - 1]
			: value;
		if (finalValue === undefined || finalValue === null) continue;
		style.setProperty(cssPropertyName(property), String(finalValue));
	}
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

function motionSpecForAnimation(animation: VuneAnimation, durationScale = 1): MotionSpec {
	const descriptor = animation.descriptor;
	const speed = Number.isFinite(descriptor.speed) && descriptor.speed > 0 ? descriptor.speed : 1;
	const scale = Number.isFinite(durationScale) && durationScale >= 0 ? durationScale : 1;
	if (descriptor.kind === 'spring') {
		return spring({
			response: Math.max(0.001, (descriptor.response ?? descriptor.duration) * scale / speed),
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
	return timing({ duration: Math.max(0, descriptor.duration * scale / speed), curve });
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
	private readonly elementPropertyCancels = new WeakMap<Element, Map<string, () => void>>();

	private cancelElementProperties(element: Element, properties: string[]): void {
		const cancels = this.elementPropertyCancels.get(element);
		if (!cancels) return;
		const pending = new Set<() => void>();
		for (const property of properties) {
			const cancel = cancels.get(property);
			if (cancel) pending.add(cancel);
		}
		for (const cancel of pending) cancel();
	}

	private trackElementProperties(element: Element, properties: string[], handle: MotionHandle): void {
		if (properties.length === 0) return;
		let cancels = this.elementPropertyCancels.get(element);
		if (!cancels) {
			cancels = new Map();
			this.elementPropertyCancels.set(element, cancels);
		}
		const cancel = (): void => handle.cancel();
		for (const property of properties) cancels.set(property, cancel);
		const cleanup = (): void => {
			const current = this.elementPropertyCancels.get(element);
			if (!current) return;
			for (const property of properties) {
				if (current.get(property) === cancel) current.delete(property);
			}
			if (current.size === 0) this.elementPropertyCancels.delete(element);
		};
		void handle.finished.then(cleanup, cleanup);
	}

	public animate(options: MotionOptions): MotionHandle {
		const animation = options.animation ?? VuneAnimation.default;
		const { durationMs, delayMs, repeatCount, autoreverses } = animationTiming(animation);
		let resolveFinished!: (status: MotionStatus) => void;
		const finished = new Promise<MotionStatus>(resolve => { resolveFinished = resolve; });
		const finalProgress = finalKeyframeIsReverse(repeatCount, autoreverses) ? 0 : 1;

		if ((options.reducedMotion ?? 'respect') === 'respect' && reducedMotionRequested()) {
			resolveFinished(settleImmediate(options, finalProgress));
			return { finished, cancel() {} };
		}
		if (durationMs === 0) {
			resolveFinished(settleImmediate(options, finalProgress));
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
		let played = false;

		const restoreInitialValues = (): void => {
			if (options.fill !== 'none' && options.fill !== 'backwards') return;
			for (const entry of entries) style.setProperty(entry.cssProperty, String(entry.first));
		};

		const finish = (status: MotionStatus): void => {
			if (settled) return;
			settled = true;
			if (timer !== null) globalThis.clearTimeout(timer);
			timer = null;
			if (status === 'finished' && durationMs > 0 && played) restoreInitialValues();
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
			const reverse = finalKeyframeIsReverse(repeatCount, autoreverses);
			for (const entry of entries) {
				style.setProperty(entry.cssProperty, String(reverse ? entry.first : entry.last));
			}
			finish('finished');
			return { finished, cancel };
		}

		const startCycle = (): void => {
			if (settled) return;
			played = true;
			const reverse = autoreverses && cycle % 2 === 1;
			const motionEngine = options.reducedMotion === 'ignore' ? unrestrictedMotionEngine : sharedMotionEngine;
			currentControls = [];

			const playEntry = async (entry: InterpolatedKeyframe): Promise<MotionStatus> => {
				const segments = reverse ? [...entry.segments].reverse() : entry.segments;
				for (const segment of segments) {
					if (settled) return 'cancelled';
					const from = reverse ? segment.to : segment.from;
					const to = reverse ? segment.from : segment.to;
					if (segment.durationScale === 0) {
						style.setProperty(entry.cssProperty, String(to));
						continue;
					}
					const control = animateInterpolated(
						from,
						to,
						motionSpecForAnimation(animation, segment.durationScale),
						value => style.setProperty(entry.cssProperty, String(value)),
						{ engine: motionEngine, ...segment.options },
					);
					currentControls.push(control);
					const result = await control.finished;
					if (result.status !== 'finished') return 'cancelled';
				}
				return 'finished';
			};

			void Promise.all(entries.map(entry => playEntry(entry))).then(results => {
				if (settled) return;
				if (results.some(result => result !== 'finished')) {
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
				for (const entry of entries) style.setProperty(entry.cssProperty, String(entry.first));
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
		const properties = keyframeProperties(keyframes);
		this.cancelElementProperties(element, properties);
		let resolveFinished!: (status: MotionStatus) => void;
		const finished = new Promise<MotionStatus>(resolve => { resolveFinished = resolve; });
		const reduced = (options.reducedMotion ?? 'respect') === 'respect' && reducedMotionRequested();
		const interpolated = this.animateInterpolatedElement(element, keyframes, animation, options, reduced);
		if (interpolated) {
			this.trackElementProperties(element, properties, interpolated);
			return interpolated;
		}

		if (reduced || typeof element.animate !== 'function' || durationMs === 0) {
			applyFinalKeyframe(element, keyframes, finalKeyframeIsReverse(repeatCount, autoreverses));
			const handle = { finished, cancel() {} };
			resolveFinished('finished');
			this.trackElementProperties(element, properties, handle);
			return handle;
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
			applyFinalKeyframe(element, keyframes, finalKeyframeIsReverse(repeatCount, autoreverses));
			resolveFinished('cancelled');
			const handle = { finished, cancel() {} };
			this.trackElementProperties(element, properties, handle);
			return handle;
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

		const handle = {
			finished,
			cancel,
		};
		this.trackElementProperties(element, properties, handle);
		return handle;
	}

	public cancelAll(): void {
		for (const cancel of [...this.activeCancels]) cancel();
		for (const cancel of [...this.elementCancels]) cancel();
		for (const animation of [...this.elementAnimations]) animation.cancel();
		this.elementAnimations.clear();
	}
}

export const vuneMotion = new VuneMotionEngine();

/**
 * Bridge a Vue JS transition hook to the shared Vune element animator.
 *
 * Vue removes an element only after the hook calls `done`; keeping that
 * lifecycle edge here prevents individual components from reimplementing the
 * promise/cancellation plumbing around `animateElement`.
 */
export function animateVuneTransition(
	element: Element,
	keyframes: Keyframe[],
	animation: VuneAnimation,
	done: () => void,
): MotionHandle {
	const handle = vuneMotion.animateElement(element, keyframes, {
		animation,
		fill: 'forwards',
	});
	void handle.finished.then(done, done);
	return handle;
}
