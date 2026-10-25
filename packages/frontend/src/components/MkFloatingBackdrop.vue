<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" data-progressive-blur aria-hidden="true">
	<div :class="$style.dim" :style="holeMask(8)"></div>
	<template v-if="blur">
		<div v-for="(band, index) in bands" :key="index" :class="$style.band" :style="band"></div>
	</template>
	<div :class="$style.halo" :style="haloStyle"></div>
</div>
</template>

<script lang="ts" setup>
// Backdrop for the floating menu: the page blurs progressively away from the
// pressed element, which stays sharp inside a feathered hole and gets a shadow
// so it reads as lifted. Fades through the inherited --MI-fade like MkProgressiveBlur.
import { computed } from 'vue';

export type FloatingHole = { left: number; top: number; width: number; height: number; radius: number; };

const props = defineProps<{
	hole: FloatingHole;
	blur: boolean;
}>();

/** Gap between the element and where the backdrop starts. */
const PAD = 6;

const expanded = computed(() => ({
	left: props.hole.left - PAD,
	top: props.hole.top - PAD,
	width: props.hole.width + PAD * 2,
	height: props.hole.height + PAD * 2,
	radius: Math.max(props.hole.radius + PAD, 12),
}));

/** Viewport-sized alpha mask that is opaque everywhere except a feathered hole. */
function holeMask(feather: number) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const h = expanded.value;
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${vw}' height='${vh}'>`
		+ `<filter id='f' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${feather}'/></filter>`
		+ '<mask id=\'m\'><rect width=\'100%\' height=\'100%\' fill=\'white\'/>'
		+ `<rect x='${h.left}' y='${h.top}' width='${h.width}' height='${h.height}' rx='${h.radius}' fill='black'${feather > 0 ? ' filter=\'url(#f)\'' : ''}/></mask>`
		+ '<rect width=\'100%\' height=\'100%\' fill=\'white\' mask=\'url(#m)\'/></svg>';
	const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
	return { maskImage: url, WebkitMaskImage: url };
}

// Wider feathers carry stronger blur, so sharpness falls off with distance.
const bands = computed(() => [[2, 1], [4, 5], [7, 10], [10, 18]].map(([px, feather]) => {
	const value = `blur(calc(${px}px * var(--MI-fade, 1)))`;
	return { backdropFilter: value, WebkitBackdropFilter: value, ...holeMask(feather) };
}));

const haloStyle = computed(() => ({
	left: `${expanded.value.left}px`,
	top: `${expanded.value.top}px`,
	width: `${expanded.value.width}px`,
	height: `${expanded.value.height}px`,
	borderRadius: `${expanded.value.radius}px`,
}));
</script>

<style lang="scss" module>
.root {
	position: fixed;
	inset: 0;
	pointer-events: none;
}

.band {
	position: absolute;
	inset: 0;
}

.dim {
	position: absolute;
	inset: 0;
	background: var(--MI_THEME-modalBg);
	opacity: var(--MI-fade, 1);
}

.halo {
	position: absolute;
	box-shadow: 0 0 0 1px var(--MI-hairline), 0 14px 36px -10px var(--MI_THEME-shadow);
	opacity: var(--MI-fade, 1);
}

@media (prefers-reduced-transparency: reduce) {
	.band { display: none; }
}
</style>
