<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneImageEffectorLayer
	:label="fx.uiDefinition.name"
	:params="layer.params"
	:paramDefs="fx.uiDefinition.params"
	:onUpdateParams="(value: ImageEffectorLayer['params']) => layer.params = value"
	:onDelete="() => emit('del')"
	:onSwapUp="() => emit('swapUp')"
	:onSwapDown="() => emit('swapDown')"
/>
</template>

<script setup lang="ts">
import type { ImageEffectorLayer } from '@/utility/image-effector/ImageEffector.js';
import VuneImageEffectorLayer from './vune/MkImageEffectorDialog.Layer.vune?vue-host';
import { FXS } from '@/utility/image-effector/fxs.js';

const layer = defineModel<ImageEffectorLayer>('layer', { required: true });
const fx = FXS[layer.value.fxId];
if (fx == null) {
	throw new Error(`Unrecognized effect: ${layer.value.fxId}`);
}

const emit = defineEmits<{
	(ev: 'del'): void;
	(ev: 'swapUp'): void;
	(ev: 'swapDown'): void;
}>();
</script>
