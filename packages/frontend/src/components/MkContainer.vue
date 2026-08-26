<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneContainer
	ref="vuneRef"
	v-bind="$attrs"
	:showHeader="showHeader"
	:thin="thin"
	:naked="naked"
	:foldable="foldable"
	:scrollable="scrollable"
	:showBody="showBody"
	:omitted="omitted"
	:maxHeight="maxHeight"
	:contentHeight="contentHeight"
	:headerHeight="headerHeight"
	:animated="prefer.s.animation === true"
	:testId="$attrs['data-testid']"
	:dataTransparent="$attrs['data-transparent']"
	:onToggle="toggleBody"
	:onShowMore="showMore"
>
	<template #icon><slot name="icon"></slot></template>
	<template #header><slot name="header"></slot></template>
	<template #func="slotProps"><slot name="func" v-bind="slotProps"></slot></template>
	<slot></slot>
</VuneContainer>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { prefer } from '@/preferences.js';
import VuneContainer from '@/components/vune/MkContainer.vune';

const props = withDefaults(defineProps<{
	showHeader?: boolean;
	thin?: boolean;
	naked?: boolean;
	foldable?: boolean;
	scrollable?: boolean;
	expanded?: boolean;
	maxHeight?: number | null;
}>(), {
	expanded: true,
	showHeader: true,
	maxHeight: null,
});

const vuneRef = useTemplateRef<HTMLElement | { $el?: unknown }>('vuneRef');
const showBody = ref(props.expanded);
const ignoreOmit = ref(false);
const omitted = ref(false);

const contentHeight = ref<number | null>(null);
const headerHeight = ref(0);
let omitObserver: ResizeObserver | undefined;

function hostElement(): HTMLElement | null {
	const value = vuneRef.value;
	if (value instanceof HTMLElement) return value;
	const element = value?.$el;
	return element instanceof HTMLElement ? element : null;
}

function measureContent(element: HTMLElement): number {
	return Math.max(element.scrollHeight, element.getBoundingClientRect().height);
}

function syncMeasurements() {
	const root = hostElement();
	if (!root) return;
	const header = root.querySelector<HTMLElement>('[data-vune-container-header]');
	const content = root.querySelector<HTMLElement>('[data-vune-container-content]');
	headerHeight.value = props.showHeader ? header?.offsetHeight ?? 0 : 0;
	const height = content ? measureContent(content) : 0;
	contentHeight.value = height;
	if (!ignoreOmit.value) omitted.value = props.maxHeight != null && height > props.maxHeight;
	omitObserver?.disconnect();
	if (content) omitObserver?.observe(content);
}

function toggleBody() {
	showBody.value = !showBody.value;
}

function showMore() {
	ignoreOmit.value = true;
	omitted.value = false;
	nextTick().then(syncMeasurements);
}

onMounted(() => {
	omitObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => syncMeasurements());
	nextTick().then(syncMeasurements);
});

onUnmounted(() => {
	omitObserver?.disconnect();
});

watch(showBody, () => {
	nextTick().then(syncMeasurements);
});

watch([() => props.maxHeight, () => props.showHeader], () => {
	nextTick().then(syncMeasurements);
});
</script>
