<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button :class="[$style.root, { [$style.tucked]: tucked }]" class="_button" :aria-label="i18n.ts.note" @click="os.post()">
	<i class="ti ti-pencil"></i>
</button>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

// Keep the end of the feed clear of the floating button.
window.document.body.style.setProperty('--MI-minBottomSpacing', 'var(--MI-minBottomSpacingMobile)');
onUnmounted(() => {
	window.document.body.style.setProperty('--MI-minBottomSpacing', '0px');
});

// Tuck the button away while reading down the feed, bring it back as soon as the user scrolls up.
const tucked = ref(false);
const lastScrollTops = new WeakMap<EventTarget, number>();
const THRESHOLD = 8;

function onScroll(ev: Event) {
	const target = ev.target;
	if (!(target instanceof HTMLElement)) return;
	const top = target.scrollTop;
	const last = lastScrollTops.get(target);
	if (last == null) {
		lastScrollTops.set(target, top);
		return;
	}
	if (Math.abs(top - last) < THRESHOLD) return;
	lastScrollTops.set(target, top);
	// Near the top there's nothing to read past, so keep it visible.
	tucked.value = top > last && top > 120;
}

onMounted(() => {
	window.document.addEventListener('scroll', onScroll, { capture: true, passive: true });
});
onUnmounted(() => {
	window.document.removeEventListener('scroll', onScroll, { capture: true });
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	z-index: 10;
	right: 16px;
	bottom: max(16px, env(safe-area-inset-bottom, 0px));
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 100%;
	font-size: 18px;
	color: var(--MI_THEME-fgOnAccent);
	background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
	box-shadow: 0 6px 16px -6px var(--MI_THEME-shadow);
	transition:
		filter var(--MI-durFast) var(--MI-easeOut),
		opacity var(--MI-dur) var(--MI-easeOut),
		transform 380ms cubic-bezier(0.34, 1.4, 0.5, 1);
	animation: pop-in 420ms cubic-bezier(0.34, 1.4, 0.5, 1) backwards;

	&.tucked {
		opacity: 0;
		pointer-events: none;
		transform: translateY(calc(100% + 24px)) scale(0.6);
		transition:
			opacity var(--MI-dur) var(--MI-easeOut),
			transform var(--MI-dur) cubic-bezier(0.4, 0, 1, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		animation: none;
		transition: filter var(--MI-durFast) var(--MI-easeOut), opacity var(--MI-dur) var(--MI-easeOut);

		&.tucked {
			transform: none;
		}
	}

	&:hover {
		filter: brightness(1.08);
	}

	&:active {
		filter: brightness(0.94);
		transform: scale(0.95);
	}
}

@keyframes pop-in {
	from {
		opacity: 0;
		transform: scale(0.4) rotate(-45deg);
	}
}
</style>
