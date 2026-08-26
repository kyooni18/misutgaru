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
import { nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue';
import * as os from '@/os.js';
import { calcPopupPosition } from '@/utility/popup-position.js';
import { prefer } from '@/preferences.js';
import { Animation } from 'vune-ui';
import { animateVuneTransition } from '@/vune/motion.js';

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
	animateVuneTransition(element, [
		{ opacity: 0, transform: 'scale(0.75)' },
		{ opacity: 1, transform: 'scale(1)' },
	], Animation.easeOut(0.2), done);
}

function leave(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateVuneTransition(element, [
		{ opacity: 1, transform: 'scale(1)' },
		{ opacity: 0, transform: 'scale(0.75)' },
	], Animation.easeIn(0.2), done);
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

let loopHandler: number | null = null;

onMounted(() => {
	nextTick(() => {
		setPosition();

		const loop = () => {
			setPosition();
			loopHandler = window.requestAnimationFrame(loop);
		};

		loop();
	});
});

onUnmounted(() => {
	if (loopHandler != null) window.cancelAnimationFrame(loopHandler);
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
