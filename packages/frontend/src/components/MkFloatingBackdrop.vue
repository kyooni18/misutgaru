<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" data-progressive-blur aria-hidden="true">
	<div :class="$style.dim" :style="holeMask(4, 12)"></div>
	<template v-if="blur">
		<div v-for="(band, index) in bands" :key="index" :class="$style.band" :style="band"></div>
	</template>
</div>
</template>

<script lang="ts" setup>
// Backdrop for the floating menu: the page blurs progressively away from the
// pressed element, which stays sharp inside a feathered hole.
// Fades through the inherited --MI-fade like MkProgressiveBlur.
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
}));

/** Add the two exterior ramps: only their shared central rectangle stays clear. */
function holeMask(feather: number, clearance: number) {
	const h = expanded.value;
	const left = h.left - clearance;
	const right = h.left + h.width + clearance;
	const top = h.top - clearance;
	const bottom = h.top + h.height + clearance;
	// Start the feather outside the control, keeping its text completely sharp.
	// CSS ramps keep mask coordinates tied to the viewport without SVG image sizing.
	const horizontal = `linear-gradient(to right, black ${left - feather}px, transparent ${left}px, transparent ${right}px, black ${right + feather}px)`;
	const vertical = `linear-gradient(to bottom, black ${top - feather}px, transparent ${top}px, transparent ${bottom}px, black ${bottom + feather}px)`;
	const mask = `${horizontal}, ${vertical}`;
	return { maskImage: mask, WebkitMaskImage: mask, maskComposite: 'add', WebkitMaskComposite: 'source-over' };
}

// Each stronger layer starts farther from the anchor, leaving a broad readable
// focus region and a visible progression instead of a uniform full-screen blur.
// Keep the combined blur modest so the menu's own edge blur remains visible.
const bands = computed(() => [[0.5, 16, 12], [1, 32, 32], [2, 48, 64], [3, 64, 104]].map(([px, feather, clearance]) => {
	const value = `blur(calc(${px}px * var(--MI-fade, 1)))`;
	return { backdropFilter: value, WebkitBackdropFilter: value, ...holeMask(feather, clearance) };
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
	opacity: calc(0.35 * var(--MI-fade, 1));
}

@media (prefers-reduced-transparency: reduce) {
	.band { display: none; }
}
</style>
