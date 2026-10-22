/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Mün view that surrounds its content with a progressive backdrop-blur halo
 * and a light glass panel (see "Progressive blur picker" design report v8).
 *
 * The halo is a set of sibling layers, never nested, so every layer samples the
 * page behind it and their blurs stack. The wrapper itself carries no filter so
 * it does not become a backdrop root.
 */

import { Element, defineView, initializer } from '@mun/core/compat';
import type { ViewValue } from '@mun/core/compat';

export type ProgressiveBlurLayer = {
	/** Distance from the content edge at which this layer fades to zero (px). */
	readonly reach: number;
	/** Backdrop blur at the content edge (px). */
	readonly blur: number;
	/** Backdrop saturation (%). */
	readonly saturate?: number;
};

export type ProgressiveBlurOptions = {
	/** Halo is only rendered while active (e.g. while a picker is open). */
	readonly active: boolean;
	readonly layers?: readonly ProgressiveBlurLayer[];
	/** Render the content inside the glass panel material. Default: true. */
	readonly glass?: boolean;
	readonly radius?: number;
	readonly className?: string;
};

/** Outer → inner. Combined edge blur ≈ √(1² + 2² + 3.5² + 5²) ≈ 6.5px, under the 7px readability limit. */
export const defaultProgressiveBlurLayers: readonly ProgressiveBlurLayer[] = [
	{ reach: 96, blur: 1, saturate: 105 },
	{ reach: 72, blur: 2, saturate: 105 },
	{ reach: 48, blur: 3.5, saturate: 105 },
	{ reach: 24, blur: 5, saturate: 105 },
];

export function combinedEdgeBlur(layers: readonly ProgressiveBlurLayer[]): number {
	return Math.sqrt(layers.reduce((sum, layer) => sum + layer.blur ** 2, 0));
}

function rampMask(reach: number): string {
	return `linear-gradient(to right, transparent, #000 ${reach}px, #000 calc(100% - ${reach}px), transparent)`;
}

function haloLayerStyle(layer: ProgressiveBlurLayer, radius: number): string {
	const filter = `blur(${layer.blur}px) saturate(${layer.saturate ?? 100}%)`;
	const horizontal = rampMask(layer.reach);
	const vertical = horizontal.replace('to right', 'to bottom');
	return [
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
		const layers = options.layers ?? defaultProgressiveBlurLayers;
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
