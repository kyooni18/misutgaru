/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { claimMotionProperties, releaseMotionProperties } from './ownership.js';
import type { MotionPropertyOwner } from './ownership.js';
import { motionPolicy } from './policy.js';
import type { MotionAnimateOptions, MotionHandle, MotionKeyframes, MotionRetargetOptions, MotionStatus } from './types.js';

const KEYFRAME_META_PROPERTIES = new Set(['offset', 'easing', 'composite', 'computedOffset']);

function uniqueProperties(properties: Iterable<string>): string[] {
	return [...new Set([...properties].filter(property => !KEYFRAME_META_PROPERTIES.has(property)))];
}

export function motionPropertiesFromKeyframes(keyframes: MotionKeyframes): string[] {
	if (Array.isArray(keyframes)) {
		const properties: string[] = [];
		for (const frame of keyframes) properties.push(...Object.keys(frame));
		return uniqueProperties(properties);
	}
	return uniqueProperties(Object.keys(keyframes));
}

function finalKeyframeValues(keyframes: MotionKeyframes, properties: readonly string[]): Record<string, string | number> {
	const result: Record<string, string | number> = {};
	if (Array.isArray(keyframes)) {
		for (let index = keyframes.length - 1; index >= 0; index -= 1) {
			const frame = keyframes[index];
			for (const property of properties) {
				if (result[property] != null) continue;
				const value = frame[property as keyof Keyframe];
				if (typeof value === 'string' || typeof value === 'number') result[property] = value;
			}
		}
		return result;
	}

	for (const property of properties) {
		const value = keyframes[property as keyof PropertyIndexedKeyframes];
		if (Array.isArray(value)) {
			const finalValue = value[value.length - 1];
			if (typeof finalValue === 'string' || typeof finalValue === 'number') result[property] = finalValue;
		} else if (typeof value === 'string' || typeof value === 'number') {
			result[property] = value;
		}
	}
	return result;
}

function setStyleValue(element: Element, property: string, value: string | number): void {
	if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return;
	const style = element.style;
	if (property.startsWith('--')) {
		style.setProperty(property, String(value));
	} else {
		(style as unknown as Record<string, string>)[property] = String(value);
	}
}

function applyFinalKeyframe(element: Element, keyframes: MotionKeyframes, properties: readonly string[]): void {
	const values = finalKeyframeValues(keyframes, properties);
	for (const [property, value] of Object.entries(values)) setStyleValue(element, property, value);
}

function currentKeyframe(element: Element, properties: readonly string[]): Keyframe {
	const computed = window.getComputedStyle(element);
	const inlineStyle = (element instanceof HTMLElement || element instanceof SVGElement) ? element.style : null;
	const frame: Record<string, string> = {};
	for (const property of properties) {
		const computedValue = property.startsWith('--')
			? computed.getPropertyValue(property)
			: (computed as unknown as Record<string, string>)[property] ?? computed.getPropertyValue(property);
		const inlineValue = inlineStyle == null
			? ''
			: property.startsWith('--')
				? inlineStyle.getPropertyValue(property)
				: (inlineStyle as unknown as Record<string, string>)[property] ?? inlineStyle.getPropertyValue(property);
		const value = computedValue !== '' ? computedValue : inlineValue;
		if (value !== '') frame[property] = value;
	}
	return frame as Keyframe;
}

function retargetKeyframes(element: Element, keyframes: MotionKeyframes, properties: readonly string[]): MotionKeyframes {
	const current = currentKeyframe(element, properties);
	if (Array.isArray(keyframes)) {
		if (keyframes.length === 0) return [current];
		return [{ ...keyframes[0], ...current }, ...keyframes.slice(1)];
	}

	const frames: Keyframe[] = [current, {}];
	const final = finalKeyframeValues(keyframes, properties);
	for (const [property, value] of Object.entries(final)) {
		(frames[1] as unknown as Record<string, string | number>)[property] = value;
	}
	return frames;
}

class MotionAnimationHandle implements MotionHandle, MotionPropertyOwner {
	private nativeAnimation: Animation | null = null;
	private currentKeyframes: MotionKeyframes;
	private currentOptions: MotionAnimateOptions;
	private properties: string[] = [];
	private generation = 0;
	private _status: MotionStatus = 'idle';
	private resolveFinished!: (status: MotionStatus) => void;
	public readonly finished: Promise<MotionStatus>;

	constructor(private readonly element: Element, keyframes: MotionKeyframes, options: MotionAnimateOptions) {
		this.currentKeyframes = keyframes;
		this.currentOptions = options;
		this.finished = new Promise(resolve => { this.resolveFinished = resolve; });
		this.start(keyframes, options);
	}

	public get status(): MotionStatus {
		return this._status;
	}

	public cancel(): void {
		if (this.isTerminal()) return;
		this.generation += 1;
		this.nativeAnimation?.cancel();
		this.nativeAnimation = null;
		this.finalize('cancelled');
	}

	public finish(): void {
		if (this.isTerminal()) return;
		if (this.nativeAnimation != null) {
			try {
				this.nativeAnimation.finish();
				this.commitNativeStyles();
			} catch {
				applyFinalKeyframe(this.element, this.currentKeyframes, this.properties);
			}
			this.generation += 1;
			this.nativeAnimation.cancel();
			this.nativeAnimation = null;
		} else {
			applyFinalKeyframe(this.element, this.currentKeyframes, this.properties);
		}
		this.finalize('finished');
	}

	public pause(): void {
		if (this._status !== 'running' || this.nativeAnimation == null) return;
		this.nativeAnimation.pause();
		this._status = 'paused';
	}

	public play(): void {
		if (this._status !== 'paused' || this.nativeAnimation == null) return;
		this.nativeAnimation.play();
		this._status = 'running';
	}

	public reverse(): void {
		if (this.isTerminal() || this.nativeAnimation == null) return;
		this.nativeAnimation.reverse();
		this._status = 'running';
	}

	public retarget(keyframes: MotionKeyframes, options: MotionRetargetOptions = {}): void {
		if (this.isTerminal()) return;
		const nextOptions: MotionAnimateOptions = { ...this.currentOptions, ...options };
		const nextProperties = options.properties != null ? [...options.properties] : motionPropertiesFromKeyframes(keyframes);
		this.commitNativeStyles();
		const continuousKeyframes = retargetKeyframes(this.element, keyframes, nextProperties);
		this.generation += 1;
		this.nativeAnimation?.cancel();
		this.nativeAnimation = null;
		releaseMotionProperties(this.element, this.properties, this);
		this.start(continuousKeyframes, nextOptions);
	}

	public replaceByNewOwner(): void {
		if (this.isTerminal()) return;
		this.commitNativeStyles();
		this.generation += 1;
		this.nativeAnimation?.cancel();
		this.nativeAnimation = null;
		this.finalize('cancelled');
	}

	private start(keyframes: MotionKeyframes, options: MotionAnimateOptions): void {
		this.currentKeyframes = keyframes;
		this.currentOptions = options;
		this.properties = options.properties != null ? [...options.properties] : motionPropertiesFromKeyframes(keyframes);
		claimMotionProperties(this.element, this.properties, this);

		const presetName = options.preset ?? 'control';
		const category = options.category ?? 'functional';
		const resolved = motionPolicy.resolve(presetName, category, { duration: options.duration, easing: options.easing });

		if (resolved.disabled || typeof this.element.animate !== 'function') {
			applyFinalKeyframe(this.element, keyframes, this.properties);
			this.finalize('finished');
			return;
		}

		const generation = ++this.generation;
		const { preset: _preset, category: _category, properties: _properties, scope: _scope, duration: _duration, easing: _easing, ...nativeOptions } = options;
		const animationOptions: KeyframeAnimationOptions = {
			...nativeOptions,
			duration: resolved.duration,
			easing: resolved.easing,
			fill: options.fill ?? 'both',
		};

		this._status = 'running';
		this.nativeAnimation = this.element.animate(keyframes, animationOptions);
		void this.nativeAnimation.finished.then(() => {
			if (generation !== this.generation || this.isTerminal()) return;
			this.commitNativeStyles();
			this.generation += 1;
			this.nativeAnimation?.cancel();
			this.nativeAnimation = null;
			this.finalize('finished');
		}, () => {
			// A replacement, retarget, or explicit cancellation advances generation
			// before cancelling the native animation, so its rejected `finished`
			// promise must not change the new owner's lifecycle.
		});
	}

	private commitNativeStyles(): void {
		if (this.nativeAnimation == null) return;
		try {
			this.nativeAnimation.commitStyles();
		} catch {
			const frame = currentKeyframe(this.element, this.properties);
			for (const property of this.properties) {
				const value = frame[property as keyof Keyframe];
				if (typeof value === 'string' || typeof value === 'number') setStyleValue(this.element, property, value);
			}
		}
	}

	private finalize(status: Extract<MotionStatus, 'finished' | 'cancelled'>): void {
		if (this.isTerminal()) return;
		releaseMotionProperties(this.element, this.properties, this);
		this._status = status;
		this.resolveFinished(status);
	}

	private isTerminal(): boolean {
		return this._status === 'finished' || this._status === 'cancelled';
	}
}

export function animateMotion(element: Element, keyframes: MotionKeyframes, options: MotionAnimateOptions = {}): MotionHandle {
	const handle = new MotionAnimationHandle(element, keyframes, options);
	options.scope?.track(handle);
	return handle;
}
