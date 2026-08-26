<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="host">
	<VuneFoldableSection
		:showBody="showBody"
		:parentBg="parentBg"
		:contentHeight="contentHeight"
		:headerHeight="headerHeight"
		:animated="prefer.s.animation === true"
		:onToggle="toggle"
	>
		<template #header><slot name="header"></slot></template>
		<template #default><slot></slot></template>
	</VuneFoldableSection>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { themeManager } from '@/theme.js';
import { getBgColor } from '@/utility/get-bg-color.js';
import VuneFoldableSection from './vune/MkFoldableSection.vune';

const miLocalStoragePrefix = 'ui:folder:' as const;

const props = withDefaults(defineProps<{
	expanded?: boolean;
	persistKey?: string | null;
}>(), {
	expanded: true,
	persistKey: null,
});

const host = useTemplateRef<HTMLElement | { $el?: unknown }>('host');
const parentBg = ref<string | null>(null);
const contentHeight = ref(0);
const headerHeight = ref(0);
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const showBody = ref((props.persistKey && miLocalStorage.getItem(`${miLocalStoragePrefix}${props.persistKey}`)) ? (miLocalStorage.getItem(`${miLocalStoragePrefix}${props.persistKey}`) === 't') : props.expanded);

let resizeObserver: ResizeObserver | undefined;
let observedContent: HTMLElement | null = null;

function hostElement(): HTMLElement | null {
	const value = host.value as unknown;
	if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) return value;
	if (value && typeof value === 'object' && '$el' in value) {
		const element = (value as { $el?: unknown }).$el;
		if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) return element;
	}
	return null;
}

function syncMeasurements(): void {
	const element = hostElement();
	if (!element) return;

	const header = element.querySelector<HTMLElement>('[data-vune-foldable-header]');
	const body = element.querySelector<HTMLElement>('[data-vune-foldable-body]');
	const content = element.querySelector<HTMLElement>('[data-vune-foldable-content]');
	if (header) {
		const nextHeaderHeight = Math.ceil(header.getBoundingClientRect().height);
		if (nextHeaderHeight !== headerHeight.value) headerHeight.value = nextHeaderHeight;
	}
	if (content) {
		if (observedContent !== content) {
			resizeObserver?.disconnect();
			resizeObserver?.observe(content);
			observedContent = content;
		}
		const nextContentHeight = Math.ceil(Math.max(content.scrollHeight, body?.scrollHeight ?? 0, content.getBoundingClientRect().height));
		if (nextContentHeight !== contentHeight.value) contentHeight.value = nextContentHeight;
	}

	parentBg.value = getBgColor(element.parentElement);
}

function toggle(): void {
	showBody.value = !showBody.value;
}

watch(showBody, () => {
	if (props.persistKey) {
		miLocalStorage.setItem(`${miLocalStoragePrefix}${props.persistKey}`, showBody.value ? 't' : 'f');
	}
});

onMounted(() => {
	resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(syncMeasurements);
	nextTick().then(syncMeasurements);
	themeManager.on('themeChanging', syncMeasurements);
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = undefined;
	observedContent = null;
	themeManager.off('themeChanging', syncMeasurements);
});
</script>
