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

const SCROLLBAR_THICKNESS = 16;

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

	let left = props.anchorElement.offsetWidth;
	let top = (parentRect.top - rootRect.top) - 8;
	if (rootRect.left + left + myRect.width >= (window.innerWidth - SCROLLBAR_THICKNESS)) {
		left = -myRect.width;
	}
	if (rootRect.top + top + myRect.height >= (window.innerHeight - SCROLLBAR_THICKNESS)) {
		top = top - ((rootRect.top + top + myRect.height) - (window.innerHeight - SCROLLBAR_THICKNESS));
	}
	el.value.style.left = left + 'px';
	el.value.style.top = top + 'px';
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
});

onUnmounted(() => {
	ro.disconnect();
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
}
</style>
