<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	appear :css="false"
	@enter="enter"
	@leave="leave"
	@afterLeave="emit('closed')"
>
	<div v-show="showing" ref="el" :class="$style.root" class="_acrylic _shadow" :style="{ zIndex, maxWidth: maxWidth + 'px' }">
		<slot>
			<template v-if="text">
				<Mfm v-if="asMfm" :text="text"/>
				<span v-else>{{ text }}</span>
			</template>
		</slot>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, useTemplateRef, watch } from 'vue';
import * as os from '@/os.js';
import { calcPopupPosition } from '@/utility/popup-position.js';
import { prefer } from '@/preferences.js';
import { animateSurfaceTransition } from '@/vune/motion.js';

const props = withDefaults(defineProps<{
	showing: boolean;
	anchorElement?: HTMLElement;
	x?: number;
	y?: number;
	text?: string;
	asMfm?: boolean;
	maxWidth?: number;
	direction?: 'top' | 'bottom' | 'right' | 'left';
	innerMargin?: number;
}>(), {
	maxWidth: 250,
	direction: 'top',
	innerMargin: 0,
});

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

// タイミングによっては最初から showing = false な場合があり、その場合に closed 扱いにしないと永久にDOMに残ることになる
if (!props.showing) emit('closed');

const el = useTemplateRef('el');
const zIndex = os.claimZIndex('high');

function enter(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateSurfaceTransition(element, 'enter', done);
}

function leave(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateSurfaceTransition(element, 'leave', done);
}

function setPosition() {
	if (el.value == null) return;
	const data = calcPopupPosition(el.value, {
		anchorElement: props.anchorElement,
		direction: props.direction,
		align: 'center',
		innerMargin: props.innerMargin,
		x: props.x,
		y: props.y,
	});

	el.value.style.transformOrigin = data.transformOrigin;
	el.value.style.left = data.left + 'px';
	el.value.style.top = data.top + 'px';
}

let positionFrame: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let tracking = false;

function cancelScheduledPosition() {
	if (positionFrame == null) return;
	window.cancelAnimationFrame(positionFrame);
	positionFrame = null;
}

function schedulePosition() {
	if (!props.showing || positionFrame != null) return;
	positionFrame = window.requestAnimationFrame(() => {
		positionFrame = null;
		if (!props.showing) return;
		setPosition();
	});
}

function stopTracking() {
	cancelScheduledPosition();
	resizeObserver?.disconnect();
	resizeObserver = null;

	if (!tracking) return;
	tracking = false;
	window.removeEventListener('scroll', schedulePosition, true);
	window.removeEventListener('resize', schedulePosition);
	window.visualViewport?.removeEventListener('scroll', schedulePosition);
	window.visualViewport?.removeEventListener('resize', schedulePosition);
}

function startTracking() {
	if (!props.showing) return;
	stopTracking();
	tracking = true;

	window.addEventListener('scroll', schedulePosition, { capture: true, passive: true });
	window.addEventListener('resize', schedulePosition, { passive: true });
	window.visualViewport?.addEventListener('scroll', schedulePosition, { passive: true });
	window.visualViewport?.addEventListener('resize', schedulePosition, { passive: true });

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(schedulePosition);
		if (el.value != null) resizeObserver.observe(el.value);
		if (props.anchorElement != null) resizeObserver.observe(props.anchorElement);
	}

	void nextTick(schedulePosition);
}

onMounted(() => {
	if (props.showing) startTracking();
});

watch(() => [props.showing, props.anchorElement] as const, () => {
	if (props.showing) startTracking();
	else stopTracking();
}, { flush: 'post' });

watch(() => [props.x, props.y, props.direction, props.innerMargin, props.maxWidth] as const, () => {
	schedulePosition();
}, { flush: 'post' });

onUnmounted(() => {
	stopTracking();
});
</script>

<style lang="scss" module>
.root {
	position: absolute;
	font-size: 0.8em;
	padding: 8px 12px;
	box-sizing: border-box;
	text-align: center;
	border-radius: 4px;
	border: solid 0.5px var(--MI_THEME-divider);
	pointer-events: none;
	transform-origin: center center;
}
</style>
