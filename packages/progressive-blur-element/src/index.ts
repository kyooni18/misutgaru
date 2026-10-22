/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Mün view that surrounds its content with a progressive backdrop-blur halo
 * and a light glass panel (see "Progressive blur picker" design report v8).
 *
 * The halo is a stack of adjacent bands (see progressiveBlurLayers), each a
 * sibling layer, never nested, so every layer samples the
 * page behind it and their blurs stack. The wrapper itself carries no filter so
 * it does not become a backdrop root.
 */

import { Element, defineView, initializer } from '@mun/core/compat';
import type { ViewValue } from '@mun/core/compat';

export type ProgressiveBlurLayer = {
	/** Distance from the content edge where this layer starts fading (px). */
	readonly from: number;
	/** Distance from the content edge where this layer reaches zero (px). */
	readonly reach: number;
	/** Backdrop blur this layer adds (px). Layers stack: totals combine as √Σb². */
	readonly blur: number;
	/** Backdrop saturation (%). Set on one layer only, since it compounds when stacked. */
	readonly saturate?: number;
};

/** high = 8 bands, balanced = 5, low = 3, off = no halo. auto picks from device hints. */
export type ProgressiveBlurQuality = 'auto' | 'high' | 'balanced' | 'low' | 'off';

export type ProgressiveBlurOptions = {
	/** Halo is only rendered while active (e.g. while a picker is open). */
	readonly active: boolean;
	/** Explicit layers; overrides quality/edgeBlur/reach. */
	readonly layers?: readonly ProgressiveBlurLayer[];
	readonly quality?: ProgressiveBlurQuality;
	/** Combined blur at the content edge (px). Keep ≤ 7 for legibility. Default: 6.5. */
	readonly edgeBlur?: number;
	/** Distance at which the blur reaches zero (px). Default: 96. */
	readonly reach?: number;
	/** Render the content inside the glass panel material. Default: true. */
	readonly glass?: boolean;
	readonly radius?: number;
	readonly className?: string;
};

const BAND_COUNT = { high: 8, balanced: 5, low: 3 } as const;
/** Bands thinner than this blur add a backdrop pass without a visible change. */
const MIN_LAYER_BLUR = 0.25;

/**
 * Splits a smooth falloff into adjacent bands. Layer k is full strength up to
 * band k-1's outer edge and fades out across band k only, so any point mixes at
 * most two neighbouring totals. Its blur is chosen so the stacked total at the
 * band's inner edge equals the target curve: b_k² = T(k)² − T(k+1)².
 * Outer → inner order (widest first), matching DOM paint order.
 */
export function progressiveBlurLayers(bands: number, edgeBlur = 6.5, reach = 96, saturate = 105): ProgressiveBlurLayer[] {
	// Ease-out falloff: blur drops quickly near the edge, then tapers softly.
	const target = (d: number) => edgeBlur * (1 - Math.min(d / reach, 1)) ** 1.6;
	const width = reach / bands;
	const layers: ProgressiveBlurLayer[] = [];
	for (let k = bands - 1; k >= 0; k--) {
		const from = k * width;
		const blur = Math.sqrt(target(from) ** 2 - target(from + width) ** 2);
		if (blur < MIN_LAYER_BLUR) continue;
		layers.push({ from, reach: from + width, blur: Math.round(blur * 100) / 100 });
	}
	if (layers.length > 0) layers[0] = { ...layers[0], saturate };
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
	const key = `${quality}|${options.edgeBlur ?? 6.5}|${options.reach ?? 96}`;
	let layers = layerSets.get(key);
	if (!layers) {
		layers = progressiveBlurLayers(BAND_COUNT[quality], options.edgeBlur, options.reach);
		layerSets.set(key, layers);
	}
	return layers;
}

function haloLayerStyle(layer: ProgressiveBlurLayer, radius: number): string {
	const key = `${layer.from}|${layer.reach}|${layer.blur}|${layer.saturate}|${radius}`;
	const cached = layerStyles.get(key);
	if (cached) return cached;
	// The box extends to `reach`; the mask ramps in over this layer's band only.
	const fade = layer.reach - layer.from;
	const filter = layer.saturate == null ? `blur(${layer.blur}px)` : `blur(${layer.blur}px) saturate(${layer.saturate}%)`;
	const horizontal = `linear-gradient(to right, transparent, #000 ${fade}px, #000 calc(100% - ${fade}px), transparent)`;
	const vertical = horizontal.replace('to right', 'to bottom');
	const style = [
		'position:absolute',
		`inset:-${layer.reach}px`,
		`border-radius:${radius + layer.reach}px`,
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

function panelStyle(radius: number, glass: boolean): string {
	const base = [
		'position:relative',
		`border-radius:${radius}px`,
		'transition:height 280ms cubic-bezier(0.2, 0, 0, 1)',
	];
	if (!glass) return base.join(';');
	const filter = 'blur(14px) saturate(130%) brightness(102%)';
	return [
		...base,
		'background:rgba(255, 250, 242, 0.2)',
		'box-shadow:inset 0 0 0 1px rgba(255, 255, 255, 0.3), 0 24px 64px -16px rgba(0, 0, 0, 0.12)',
		`backdrop-filter:${filter}`,
		`-webkit-backdrop-filter:${filter}`,
	].join(';');
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
		const halo = options.active
			? layers.map(layer => Element('div', { className: 'pbe-halo', 'aria-hidden': 'true', style: haloLayerStyle(layer, radius) }))
			: [];
		return Element('div', {
			className: ['pbe', options.className].filter(Boolean).join(' '),
			'data-active': options.active,
			// No filter/opacity/transform here: the wrapper must not become a backdrop root.
			style: 'position:relative;isolation:auto',
		},
		...halo,
		Element('div', { className: 'pbe-panel', style: panelStyle(radius, options.glass ?? true) }, content));
	},
});
