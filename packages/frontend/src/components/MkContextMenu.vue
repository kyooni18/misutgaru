<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	appear
	:css="false"
	@enter="enter"
	@leave="leave"
>
	<div ref="rootEl" :class="$style.root" :style="{ zIndex }" @contextmenu.prevent.stop="() => {}">
		<MkMenu :items="items" :align="'left'" material="thin" @close="emit('closed')"/>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, useTemplateRef, ref } from 'vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';
import { elementContains } from '@/utility/element-contains.js';
import { prefer } from '@/preferences.js';
import * as os from '@/os.js';
import { Animation } from 'vune-ui';
import { animateVuneTransition } from '@/vune/motion.js';

const props = defineProps<{
	items: MenuItem[];
	ev: PointerEvent;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const rootEl = useTemplateRef('rootEl');

const zIndex = ref<number>(os.claimZIndex('high'));

const SCROLLBAR_THICKNESS = 16;

function enter(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateContextMenuTransition(element, [
		{ opacity: 0, transform: 'scale(0.9)' },
		{ opacity: 1, transform: 'scale(1)' },
	], Animation.easeOut(0.2), done);
}

function leave(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateContextMenuTransition(element, [
		{ opacity: 1, transform: 'scale(1)' },
		{ opacity: 0, transform: 'scale(0.9)' },
	], Animation.easeIn(0.2), done);
}

function animateContextMenuTransition(
	element: Element,
	keyframes: Keyframe[],
	animation: Animation,
	done: () => void,
) {
	const materialElement = element.querySelector<HTMLElement>('[data-vune-material]');
	const materialBlur = materialElement == null
		? null
		: window.getComputedStyle(materialElement).getPropertyValue('--vune-material-blur').trim() || '12px';
	let pending = materialElement == null ? 1 : 2;
	const finish = () => {
		pending -= 1;
		if (pending === 0) done();
	};

	animateVuneTransition(element, keyframes, animation, finish);
	if (materialElement != null && materialBlur != null) {
		animateVuneTransition(materialElement, [
			{ '--vune-material-blur': keyframes[0].opacity === 0 ? '0px' : materialBlur },
			{ '--vune-material-blur': keyframes[0].opacity === 0 ? materialBlur : '0px' },
		], animation, finish);
	}
}

onMounted(() => {
	let left = props.ev.pageX + 1; // 間違って右ダブルクリックした場合に意図せずアイテムがクリックされるのを防ぐため + 1
	let top = props.ev.pageY + 1; // 間違って右ダブルクリックした場合に意図せずアイテムがクリックされるのを防ぐため + 1

	const width = rootEl.value!.offsetWidth;
	const height = rootEl.value!.offsetHeight;

	if (left + width - window.scrollX >= (window.innerWidth - SCROLLBAR_THICKNESS)) {
		left = (window.innerWidth - SCROLLBAR_THICKNESS) - width + window.scrollX;
	}

	if (top + height - window.scrollY >= (window.innerHeight - SCROLLBAR_THICKNESS)) {
		top = (window.innerHeight - SCROLLBAR_THICKNESS) - height + window.scrollY;
	}

	if (top < 0) {
		top = 0;
	}

	if (left < 0) {
		left = 0;
	}

	if (rootEl.value) {
		rootEl.value.style.top = `${top}px`;
		rootEl.value.style.left = `${left}px`;
	}

	window.document.body.addEventListener('mousedown', onMousedown);
});

onBeforeUnmount(() => {
	window.document.body.removeEventListener('mousedown', onMousedown);
});

function onMousedown(evt: MouseEvent) {
	if (!elementContains(rootEl.value, evt.target as Element) && (rootEl.value !== evt.target)) emit('closed');
}
</script>

<style lang="scss" module>
.root {
	position: absolute;
	transform-origin: left top;
}
</style>
