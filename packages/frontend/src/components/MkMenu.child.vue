<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition appear :css="false" @enter="enter" @leave="leave">
	<div ref="el" :class="$style.root">
		<MkMenu
			:items="items"
			:align="align"
			:width="width"
			:asDrawer="false"
			:material="material"
			:animated="true"
			:debugDisablePredictionCone="debugDisablePredictionCone"
			:debugShowPredictionCone="debugShowPredictionCone"
			@close="onChildClosed"
		/>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, provide, useTemplateRef, watch } from 'vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';
import type { MaterialName } from '@/vune/material.js';
import { prefer } from '@/preferences.js';
import { animateContextMenuTransition } from './MkContextMenu.motion.js';

const props = defineProps<{
	items: MenuItem[];
	anchorElement: HTMLElement;
	rootElement: HTMLElement;
	width?: number;
	material?: MaterialName;
	debugDisablePredictionCone?: boolean;
	debugShowPredictionCone?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'actioned'): void;
}>();

provide('isNestingMenu', true);

const el = useTemplateRef('el');
const align = 'left';

const VIEWPORT_MARGIN = 16;
const SUBMENU_OFFSET = 8;

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

function setPosition() {
	if (el.value == null) return;
	const rootRect = props.rootElement.getBoundingClientRect();
	const parentRect = props.anchorElement.getBoundingClientRect();
	const myRect = el.value.getBoundingClientRect();

	// Menu enter/leave animations can transform an ancestor. Convert viewport
	// measurements into the root menu's local coordinate space before writing
	// CSS offsets; mixing transformed and layout pixels makes nested menus drift
	// into the parent surface and get clipped at the viewport edge.
	const rootScaleX = rootRect.width / Math.max(props.rootElement.offsetWidth, 1) || 1;
	const rootScaleY = rootRect.height / Math.max(props.rootElement.offsetHeight, 1) || 1;
	const childWidth = el.value.offsetWidth || (myRect.width / rootScaleX);
	const childHeight = el.value.offsetHeight || (myRect.height / rootScaleY);
	const parentLeft = (parentRect.left - rootRect.left) / rootScaleX;
	const parentTop = (parentRect.top - rootRect.top) / rootScaleY;
	const parentWidth = parentRect.width / rootScaleX || props.anchorElement.offsetWidth;
	const viewportWidth = window.document.documentElement.clientWidth;
	const viewportHeight = window.document.documentElement.clientHeight;
	const viewportLeft = VIEWPORT_MARGIN;
	const viewportRight = viewportWidth - VIEWPORT_MARGIN;
	const viewportTop = VIEWPORT_MARGIN;
	const viewportBottom = viewportHeight - VIEWPORT_MARGIN;

	const rightCandidate = parentLeft + parentWidth;
	const leftCandidate = parentLeft - childWidth;
	const rightScreen = rootRect.left + (rightCandidate + childWidth) * rootScaleX;
	const leftScreen = rootRect.left + leftCandidate * rootScaleX;
	const opensLeft = rightScreen > viewportRight && leftScreen >= viewportLeft;
	let left = opensLeft ? leftCandidate : rightCandidate;
	let top = parentTop - (SUBMENU_OFFSET / rootScaleY);

	// If neither side has enough room, clamp to the side with the most
	// available space. The child menu itself remains scrollable vertically.
	const minLeft = (viewportLeft - rootRect.left) / rootScaleX;
	const maxLeft = (viewportRight - rootRect.left) / rootScaleX - childWidth;
	if (maxLeft >= minLeft) {
		left = Math.min(maxLeft, Math.max(minLeft, left));
	} else {
		left = minLeft;
	}

	const minTop = (viewportTop - rootRect.top) / rootScaleY;
	const maxTop = (viewportBottom - rootRect.top) / rootScaleY - childHeight;
	if (maxTop >= minTop) {
		top = Math.min(maxTop, Math.max(minTop, top));
	} else {
		top = minTop;
	}

	el.value.style.left = left + 'px';
	el.value.style.top = top + 'px';
	el.value.style.transformOrigin = `${opensLeft ? 'right' : 'left'} top`;
}

function onChildClosed(actioned?: boolean) {
	if (actioned) {
		emit('actioned');
	} else {
		emit('closed');
	}
}

watch(() => props.anchorElement, () => {
	setPosition();
});

const ro = new ResizeObserver((entries, observer) => {
	setPosition();
});

onMounted(() => {
	if (el.value) ro.observe(el.value);
	setPosition();
	nextTick(() => {
		setPosition();
	});
	window.addEventListener('resize', setPosition, { passive: true });
	window.addEventListener('scroll', setPosition, { passive: true, capture: true });
});

onUnmounted(() => {
	ro.disconnect();
	window.removeEventListener('resize', setPosition);
	window.removeEventListener('scroll', setPosition, true);
});

defineExpose({
	rootElement: el,
	checkHit: (ev: MouseEvent) => {
		return (ev.target === el.value || el.value?.contains(ev.target as Node));
	},
});
</script>

<style lang="scss" module>
.root {
	--mk-context-menu-scale: 1;
	position: absolute;
	transform: scale(var(--mk-context-menu-scale));
	transform-origin: left top;
	z-index: 1;
}
</style>
