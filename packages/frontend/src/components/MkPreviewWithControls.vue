<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePreviewWithControls :previewLoading="previewLoading" :animation="prefer.s.animation">
	<template #preview><slot name="preview"></slot></template>
	<template #controls><slot name="controls"></slot></template>
</VunePreviewWithControls>
</template>

<script lang="ts" setup>
import VunePreviewWithControls from './vune/MkPreviewWithControls.vune?vue-host';
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
