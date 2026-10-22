/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Mün view that surrounds its content with a progressive backdrop blur: strongest
 * at the content edge, fading to sharp with distance. It is a blur effect only;
 * the content itself is left unstyled.
 *
 * The blur is a stack of overlapping bands (see progressiveBlurLayers), each a
 * sibling layer, never nested, so every layer samples the page behind it and
 * their blurs stack. The wrapper itself carries no filter so it does not become
 * a backdrop root.
 */

import { Element, defineView, initializer } from '@mun/core/compat';
import type { ViewValue } from '@mun/core/compat';

export type ProgressiveBlurLayer = {
	/** Distance from the content edge where this layer starts fading (px). */
	readonly from: number;
	/** Distance from the content edge where this layer reaches zero (px). */
	readonly to: number;
	/** Backdrop blur this layer adds (px). Layers stack: totals combine as √Σb². */
	readonly blur: number;
};

/** high = 8 bands, balanced = 5, low = 3, off = no blur. auto picks from device hints. */
export type ProgressiveBlurQuality = 'auto' | 'high' | 'balanced' | 'low' | 'off';

/**
 * Shape of the fade from `strength` to zero. Exponent on (1 − distance/spread):
 * > 1 concentrates blur near the edge, < 1 keeps it strong further out.
 */
export type ProgressiveBlurFalloff = 'linear' | 'ease-out' | 'ease-in' | number;

export type ProgressiveBlurShape = {
	/** Blur at the content edge (px). Keep ≤ 7 when text sits under it. Default: 6.5. */
	readonly strength?: number;
	/** How far the blur spreads before reaching zero (px). Default: 96. */
	readonly spread?: number;
	/** Distance the full strength is held before fading starts (px). Default: 0. */
	readonly hold?: number;
	/** Default: 'ease-out'. */
	readonly falloff?: ProgressiveBlurFalloff;
};

export type ProgressiveBlurOptions = ProgressiveBlurShape & {
	/** Blur is only rendered while active (e.g. while a picker is open). */
	readonly active: boolean;
	/** Explicit layers; overrides quality and the shape options. */
	readonly layers?: readonly ProgressiveBlurLayer[];
	readonly quality?: ProgressiveBlurQuality;
	/** Corner radius of the content the blur hugs (px). Default: 18. */
	readonly radius?: number;
	readonly className?: string;
};

const BAND_COUNT = { high: 8, balanced: 5, low: 3 } as const;
/** Bands thinner than this blur add a backdrop pass without a visible change. */
const MIN_LAYER_BLUR = 0.25;

const FALLOFF_EXPONENT = { 'linear': 1, 'ease-out': 1.6, 'ease-in': 0.6 } as const;

/**
 * Splits a smooth falloff into overlapping bands. Each layer is full strength
 * inside its band's inner edge and fades across two band widths centred on the
 * band, so neighbouring ramps overlap instead of meeting edge to edge (which
 * reads as a ring). Its blur is chosen so the stacked total follows the target
 * curve: b_k² = T(k)² − T(k+1)². Outer → inner order, matching DOM paint order.
 */
export function progressiveBlurLayers(bands: number, shape: ProgressiveBlurShape = {}): ProgressiveBlurLayer[] {
	const { strength = 6.5, spread = 96, hold = 0, falloff = 'ease-out' } = shape;
	const exponent = typeof falloff === 'number' ? falloff : FALLOFF_EXPONENT[falloff];
	const target = (d: number) => strength * (1 - Math.min(d / spread, 1)) ** exponent;
	const width = spread / bands;
	const layers: ProgressiveBlurLayer[] = [];
	for (let k = bands - 1; k >= 0; k--) {
		const from = k * width;
		const blur = Math.sqrt(target(from) ** 2 - target(from + width) ** 2);
		if (blur < MIN_LAYER_BLUR) continue;
		layers.push({ from: hold + Math.max(0, from - width / 2), to: hold + from + width * 1.5, blur: Math.round(blur * 100) / 100 });
	}
	return layers;
}

export function combinedEdgeBlur(layers: readonly ProgressiveBlurLayer[]): number {
	return Math.sqrt(layers.reduce((sum, layer) => sum + layer.blur ** 2, 0));
}

export function resolveProgressiveBlurQuality(quality: ProgressiveBlurQuality = 'auto'): Exclude<ProgressiveBlurQuality, 'auto'> {
	if (quality !== 'auto') return quality;
	if (typeof window === 'undefined') return 'balanced';
	if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return 'off';
	const nav = navigator as Navigator & { deviceMemory?: number };
	if ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) return 'low';
	return 'high';
}

const layerSets = new Map<string, readonly ProgressiveBlurLayer[]>();
const layerStyles = new Map<string, string>();

function resolveLayers(options: ProgressiveBlurOptions): readonly ProgressiveBlurLayer[] {
	if (options.layers) return options.layers;
	const quality = resolveProgressiveBlurQuality(options.quality);
	if (quality === 'off') return [];
	const key = `${quality}|${options.strength}|${options.spread}|${options.hold}|${options.falloff}`;
	let layers = layerSets.get(key);
	if (!layers) {
		layers = progressiveBlurLayers(BAND_COUNT[quality], options);
		layerSets.set(key, layers);
	}
	return layers;
}

/**
 * Smoothstep ramp as gradient stops. A linear ramp has slope kinks at both ends,
 * which the eye picks up as hard lines (Mach bands); smoothstep has zero slope there.
 */
function easedRamp(fade: number, mirrored = false): string {
	const steps = 8;
	const stops: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const alpha = Math.round(t * t * (3 - 2 * t) * 1000) / 1000;
		const at = mirrored ? `calc(100% - ${Math.round(fade * (1 - t) * 10) / 10}px)` : `${Math.round(fade * t * 10) / 10}px`;
		stops.push(`rgba(0,0,0,${mirrored ? Math.round((1 - alpha) * 1000) / 1000 : alpha}) ${at}`);
	}
	return stops.join(', ');
}

function blurLayerStyle(layer: ProgressiveBlurLayer, radius: number): string {
	const key = `${layer.from}|${layer.to}|${layer.blur}|${radius}`;
	const cached = layerStyles.get(key);
	if (cached) return cached;
	// The box extends to `to`; the mask ramps in over this layer's band only.
	const fade = layer.to - layer.from;
	const filter = `blur(${layer.blur}px)`;
	const horizontal = `linear-gradient(to right, ${easedRamp(fade)}, ${easedRamp(fade, true)})`;
	const vertical = horizontal.replace('to right', 'to bottom');
	const style = [
		'position:absolute',
		`inset:-${layer.to}px`,
		`border-radius:${radius + layer.to}px`,
		'pointer-events:none',
		`backdrop-filter:${filter}`,
		`-webkit-backdrop-filter:${filter}`,
		`mask-image:${horizontal},${vertical}`,
		'mask-composite:intersect',
		`-webkit-mask-image:${horizontal},${vertical}`,
		'-webkit-mask-composite:source-in',
	].join(';');
	layerStyles.set(key, style);
	return style;
}

type Props = { options: ProgressiveBlurOptions; content: ViewValue };

export const ProgressiveBlurElement = defineView<Props, [ProgressiveBlurOptions, ViewValue]>('ProgressiveBlurElement', {
	initializers: [initializer(
		'ProgressiveBlurElement(_ options: ProgressiveBlurOptions, content: View)',
		args => args.length === 2 && typeof args[0] === 'object' && args[0] != null,
		args => ({ options: args[0], content: args[1] }),
	)],
	body: ({ options, content }) => {
		const radius = options.radius ?? 18;
		const layers = resolveLayers(options);
		const blur = options.active
			? layers.map(layer => Element('div', { className: 'pbe-blur', 'aria-hidden': 'true', style: blurLayerStyle(layer, radius) }))
			: [];
		return Element('div', {
			className: ['pbe', options.className].filter(Boolean).join(' '),
			'data-active': options.active,
			// No filter/opacity/transform here: the wrapper must not become a backdrop root.
			style: 'position:relative;isolation:auto',
		},
		...blur,
		Element('div', { className: 'pbe-content', style: 'position:relative' }, content));
	},
});
