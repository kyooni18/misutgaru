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
	@afterLeave="onClosed"
>
	<div v-if="showing" ref="rootEl" :class="$style.root" :style="{ zIndex }" @contextmenu.prevent.stop="() => {}">
		<MkMenu :items="items" :align="'left'" material="thin" :animated="true" @close="close"/>
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
import { animateContextMenuTransition } from './MkContextMenu.motion.js';

const props = defineProps<{
	items: MenuItem[];
	ev: PointerEvent;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const rootEl = useTemplateRef('rootEl');
const showing = ref(true);

const zIndex = ref<number>(os.claimZIndex('high'));

function close() {
	showing.value = false;
}

function onClosed() {
	emit('closed');
}

function enter(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateContextMenuTransition(element, 'enter', done);
}

function leave(element: Element, done: () => void) {
	if (!prefer.s.animation) {
		done();
		return;
	}
	animateContextMenuTransition(element, 'leave', done);
}

onMounted(() => {
	const root = rootEl.value;
	if (!root) return;

	let left = props.ev.pageX + 1; // 間違って右ダブルクリックした場合に意図せずアイテムがクリックされるのを防ぐため + 1
	let top = props.ev.pageY + 1; // 間違って右ダブルクリックした場合に意図せずアイテムがクリックされるのを防ぐため + 1

	const width = root.offsetWidth;
	const height = root.offsetHeight;
	const viewportLeft = window.scrollX;
	const viewportTop = window.scrollY;
	// clientWidth/clientHeight already exclude classic scrollbars, unlike innerWidth.
	const viewportRight = viewportLeft + window.document.documentElement.clientWidth;
	const viewportBottom = viewportTop + window.document.documentElement.clientHeight;
	let opensLeft = false;
	let opensUp = false;

	if (left + width > viewportRight) {
		left = viewportRight - width;
		opensLeft = true;
	}

	if (top + height > viewportBottom) {
		top = viewportBottom - height;
		opensUp = true;
	}

	left = Math.max(viewportLeft, left);
	top = Math.max(viewportTop, top);

	root.style.top = `${top}px`;
	root.style.left = `${left}px`;
	root.style.transformOrigin = `${opensLeft ? 'right' : 'left'} ${opensUp ? 'bottom' : 'top'}`;

	window.document.body.addEventListener('mousedown', onMousedown);
});

onBeforeUnmount(() => {
	window.document.body.removeEventListener('mousedown', onMousedown);
});

function onMousedown(evt: MouseEvent) {
	if (!elementContains(rootEl.value, evt.target as Element) && (rootEl.value !== evt.target)) close();
}
</script>

<style lang="scss" module>
.root {
	--mk-context-menu-scale: 1;

	position: absolute;
	transform: scale(var(--mk-context-menu-scale));
	transform-origin: left top;
	will-change: transform, opacity;

	:global(.vune-material--animated) {
		animation: none;
	}
}
</style>
