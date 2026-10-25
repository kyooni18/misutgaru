<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.viewport]: variant === 'viewport' }]" data-progressive-blur aria-hidden="true">
	<div v-for="(band, index) in bands" :key="index" :class="$style.band" :style="band"></div>
</div>
</template>

<script setup lang="ts">
// Background-only effect: keep this behind foreground content, never filter the
// main component. Overlapping masks fade both the strength and extent, rather
// than simply fading the opacity of a single uniform backdrop blur. No animation loop.
//
// 'edge' rings the parent element. 'viewport' covers the screen for modal
// backdrops: a light blur everywhere that strengthens toward `origin`.
// Never put either variant under an ancestor with opacity < 1 (a backdrop root).
// To fade one in or out, animate the inherited --MI-fade (0..1), which scales
// every band's radius, and fade the host's other children instead.
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	variant?: 'edge' | 'viewport';
	origin?: string;
	strength?: number;
	spread?: number;
}>(), {
	variant: 'edge',
	origin: '50% 50%',
	strength: 1,
	spread: 1,
});

function filter(px: number) {
	const value = `blur(calc(${px * props.strength}px * var(--MI-fade, 1)))`;
	return { backdropFilter: value, WebkitBackdropFilter: value };
}

const bands = computed(() => {
	if (props.variant === 'viewport') {
		return [null, 90, 65, 40].map((size, index) => {
			const mask = size == null ? 'none' : `radial-gradient(ellipse ${size}% ${size}% at ${props.origin}, black 25%, transparent 100%)`;
			return { inset: '0', ...filter(2 + index * 2), maskImage: mask, WebkitMaskImage: mask };
		});
	}
	return Array.from({ length: 5 }, (_, index) => {
		const extent = (24 + index * 18) * props.spread;
		const ramp = extent + 12 * props.spread;
		const horizontal = `linear-gradient(to right, transparent, black ${ramp}px, black calc(100% - ${ramp}px), transparent)`;
		const vertical = horizontal.replace('to right', 'to bottom');
		return {
			inset: `-${extent}px`,
			borderRadius: `${extent + 16 * props.spread}px`,
			...filter(12 - index * 2.5),
			maskImage: `${horizontal}, ${vertical}`,
			WebkitMaskImage: `${horizontal}, ${vertical}`,
		};
	});
});
</script>

<style module>
.root {
	position: absolute;
	inset: 0;
	z-index: -1;
	pointer-events: none;
}
.viewport {
	position: fixed;
	z-index: auto;
}
.band {
	position: absolute;
	mask-composite: intersect;
	-webkit-mask-composite: source-in;
}
@media (prefers-reduced-transparency: reduce) {
	.root { display: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	.root { display: none; }
}
</style>
