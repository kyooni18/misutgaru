<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePreviewWithControls :previewLoading="previewLoading" :animation="prefer.s.animation" :rootClass="$style.root" :containerClass="$style.container" :previewClass="$style.preview" :animatedBgClass="$style.animatedBg" :previewContentClass="$style.previewContent" :previewLoadingClass="$style.previewLoading" :controlsClass="$style.controls">
	<template #preview><slot name="preview"></slot></template>
	<template #controls><slot name="controls"></slot></template>
</VunePreviewWithControls>
</template>

<script lang="ts" setup>
import VunePreviewWithControls from './vune/MkPreviewWithControls.vune';
import { prefer } from '@/preferences.js';

const props = withDefaults(defineProps<{
	previewLoading?: boolean;
}>(), {
	previewLoading: false,
});

defineSlots<{
	preview: () => any;
	controls: () => any;
}>();
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
	height: 100%;
}

.container {
	height: 100%;
	display: grid;
	grid-template-columns: 1fr 400px;
}

.preview {
	position: relative;
	background-color: var(--MI_THEME-bg);
	background-image: linear-gradient(135deg, transparent 30%, var(--MI_THEME-panel) 30%, var(--MI_THEME-panel) 50%, transparent 50%, transparent 80%, var(--MI_THEME-panel) 80%, var(--MI_THEME-panel) 100%);
	background-size: 20px 20px;
}

.previewContent {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: clip;
}

.previewLoading {
	position: absolute;
	inset: 0;
	background-color: color(from var(--MI_THEME-panel) srgb r g b / 0.7);
	display: flex;
	justify-content: center;
	align-items: center;
}

.animatedBg {
	animation: bg 1.2s linear infinite;
}

@keyframes bg {
	0% { background-position: 0 0; }
	100% { background-position: -20px -20px; }
}

.controls {
	overflow-y: scroll;
}

@container (max-width: 800px) {
	.container {
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
	}
}
</style>
