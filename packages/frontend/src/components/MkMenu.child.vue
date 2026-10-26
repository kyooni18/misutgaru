<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="el" :class="$style.root">
	<div ref="boundaryEl" :class="$style.boundary" aria-hidden="true"></div>
	<MkMenu
		:items="items"
		:align="align"
		:width="width"
		:asDrawer="false"
		:debugDisablePredictionCone="debugDisablePredictionCone"
		:debugShowPredictionCone="debugShowPredictionCone"
		@close="onChildClosed"
	/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, provide, useTemplateRef, watch } from 'vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';
import { floatingBoundary, measureFloating, placeFloating } from '@/utility/floating-position.js';

const props = defineProps<{
	items: MenuItem[];
	anchorElement: HTMLElement;
	rootElement: HTMLElement;
	width?: number;
	debugDisablePredictionCone?: boolean;
	debugShowPredictionCone?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'actioned'): void;
}>();

provide('isNestingMenu', true);

const el = useTemplateRef('el');
const boundaryEl = useTemplateRef('boundaryEl');
const align = 'left';

function setPosition() {
	if (el.value == null || boundaryEl.value == null) return;
	const rootRect = props.rootElement.getBoundingClientRect();
	const parentRect = props.anchorElement.getBoundingClientRect();
	const boundary = floatingBoundary(boundaryEl.value);
	const size = measureFloating(el.value, boundary);
	const placement = placeFloating(parentRect, size, boundary, 'right', 0);
	el.value.style.left = `${placement.left - rootRect.left}px`;
	el.value.style.top = `${placement.top - rootRect.top}px`;
}

function onChildClosed(actioned?: boolean) {
	if (actioned) {
		emit('actioned');
	} else {
		emit('closed');
	}
}

let positionFrame: number | null = null;

function schedulePosition(event?: Event) {
	if (event?.type === 'scroll' && event.target instanceof Node && el.value?.contains(event.target)) return;
	if (positionFrame != null) return;

	positionFrame = requestAnimationFrame(() => {
		positionFrame = null;
		setPosition();
	});
}

watch(() => props.anchorElement, () => {
	setPosition();
});

const ro = new ResizeObserver((entries, observer) => {
	setPosition();
});

onMounted(() => {
	if (el.value) ro.observe(el.value);
	ro.observe(props.anchorElement);
	window.addEventListener('resize', schedulePosition, { passive: true });
	window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
	window.visualViewport?.addEventListener('resize', schedulePosition, { passive: true });
	window.visualViewport?.addEventListener('scroll', schedulePosition, { passive: true });
	setPosition();
	nextTick(() => {
		setPosition();
	});
});

onUnmounted(() => {
	ro.disconnect();
	if (positionFrame != null) cancelAnimationFrame(positionFrame);
	window.removeEventListener('resize', schedulePosition);
	window.removeEventListener('scroll', schedulePosition, true);
	window.visualViewport?.removeEventListener('resize', schedulePosition);
	window.visualViewport?.removeEventListener('scroll', schedulePosition);
});

defineExpose({
	rootElement: el,
	checkHit: (ev: MouseEvent) => {
		return (ev.target === el.value || el.value?.contains(ev.target as Node));
	},
});
</script>

<style lang="scss" module>
.boundary {
	position: fixed;
	visibility: hidden;
	pointer-events: none;
	padding: max(var(--MI-margin), env(safe-area-inset-top)) max(var(--MI-margin), env(safe-area-inset-right)) max(var(--MI-margin), env(safe-area-inset-bottom)) max(var(--MI-margin), env(safe-area-inset-left));
}

.root {
	position: absolute;
}
</style>
