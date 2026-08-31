<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="$style.root" :style="{ zIndex }">
	<div :class="[$style.bg]"></div>
	<div ref="spotEl" :class="$style.spot"></div>
	<div ref="bodyEl" :class="$style.body" class="_panel _shadow">
		<div class="_gaps_s">
			<div><b>{{ title }}</b></div>
			<div>{{ description }}</div>
			<div class="_buttons">
				<MkButton v-if="hasPrev" small @click="prev"><i class="ti ti-arrow-left"></i> {{ i18n.ts.goBack }}</MkButton>
				<MkButton v-if="hasNext" small primary @click="next">{{ i18n.ts.next }} <i class="ti ti-arrow-right"></i></MkButton>
				<MkButton v-else small primary @click="next">{{ i18n.ts.done }} <i class="ti ti-check"></i></MkButton>
			</div>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { calcPopupPosition } from '@/utility/popup-position.js';
import * as os from '@/os.js';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	title: string;
	description: string;
	anchorElement?: HTMLElement;
	x?: number;
	y?: number;
	direction?: 'top' | 'bottom' | 'right' | 'left';
	hasPrev: boolean;
	hasNext: boolean;
}>(), {
	direction: 'top',
});

const emit = defineEmits<{
	(prev: 'prev'): void;
	(next: 'next'): void;
}>();

function prev() {
	emit('prev');
}

function next() {
	emit('next');
}

const rootEl = useTemplateRef('rootEl');
const bodyEl = useTemplateRef('bodyEl');
const spotEl = useTemplateRef('spotEl');
const zIndex = os.claimZIndex('high');
const spotX = ref(0);
const spotY = ref(0);
const spotWidth = ref(0);
const spotHeight = ref(0);

function setPosition() {
	if (spotEl.value == null) return;
	if (bodyEl.value == null) return;
	if (props.anchorElement == null) return;

	const rect = props.anchorElement.getBoundingClientRect();
	spotX.value = rect.left;
	spotY.value = rect.top;
	spotWidth.value = rect.width;
	spotHeight.value = rect.height;

	const data = calcPopupPosition(bodyEl.value, {
		anchorElement: props.anchorElement,
		direction: props.direction,
		align: 'center',
		innerMargin: 16,
		x: props.x,
		y: props.y,
	});

	bodyEl.value.style.transformOrigin = data.transformOrigin;
	bodyEl.value.style.left = data.left + 'px';
	bodyEl.value.style.top = data.top + 'px';
}

let positionFrame: number | null = null;
let resizeObserver: ResizeObserver | null = null;

function schedulePosition() {
	if (positionFrame != null) return;
	positionFrame = window.requestAnimationFrame(() => {
		positionFrame = null;
		setPosition();
	});
}

function startTracking() {
	window.addEventListener('scroll', schedulePosition, { capture: true, passive: true });
	window.addEventListener('resize', schedulePosition, { passive: true });
	window.visualViewport?.addEventListener('scroll', schedulePosition, { passive: true });
	window.visualViewport?.addEventListener('resize', schedulePosition, { passive: true });

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(schedulePosition);
		if (bodyEl.value != null) resizeObserver.observe(bodyEl.value);
		if (props.anchorElement != null) resizeObserver.observe(props.anchorElement);
	}
}

function stopTracking() {
	if (positionFrame != null) {
		window.cancelAnimationFrame(positionFrame);
		positionFrame = null;
	}
	resizeObserver?.disconnect();
	resizeObserver = null;
	window.removeEventListener('scroll', schedulePosition, true);
	window.removeEventListener('resize', schedulePosition);
	window.visualViewport?.removeEventListener('scroll', schedulePosition);
	window.visualViewport?.removeEventListener('resize', schedulePosition);
}

onMounted(() => {
	startTracking();
	void nextTick(schedulePosition);
});

watch(() => [props.anchorElement, props.x, props.y, props.direction, props.title, props.description] as const, () => {
	resizeObserver?.disconnect();
	resizeObserver = null;
	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(schedulePosition);
		if (bodyEl.value != null) resizeObserver.observe(bodyEl.value);
		if (props.anchorElement != null) resizeObserver.observe(props.anchorElement);
	}
	schedulePosition();
}, { flush: 'post' });

onUnmounted(() => {
	stopTracking();
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
}

.bg {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
}

.spot {
	--x: v-bind("spotX + 'px'");
	--y: v-bind("spotY + 'px'");
	--width: v-bind("spotWidth + 'px'");
	--height: v-bind("spotHeight + 'px'");
	--padding: 8px;
	position: absolute;
	left: calc(var(--x) - var(--padding));
	top: calc(var(--y) - var(--padding));
	width: calc(var(--width) + var(--padding) * 2);
	height: calc(var(--height) + var(--padding) * 2);
	box-sizing: border-box;
	border: 1px solid color(from var(--MI_THEME-accent) srgb r g b / 0.75);
	border-radius: 8px;
	background: color(from var(--MI_THEME-accent) srgb r g b / 0.1);
	box-shadow: 0 0 0 9999px #000a;
	transition: left 0.2s ease-out, top 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out;

	&::after {
		content: '';
		position: absolute;
		inset: -1px;
		border: 1px solid color(from var(--MI_THEME-accent) srgb r g b / 0.75);
		border-radius: inherit;
		background: color(from var(--MI_THEME-accent) srgb r g b / 0.1);
		pointer-events: none;
		will-change: opacity;
		animation: blink 1s ease-in-out infinite;
	}
}

.body {
	position: absolute;
	padding: 16px 20px;
	box-sizing: border-box;
	width: max-content;
	max-width: min(500px, 100vw);
}

@keyframes blink {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.15;
	}
}

@media (prefers-reduced-motion: reduce) {
	.spot::after {
		animation: none;
	}
}
</style>
