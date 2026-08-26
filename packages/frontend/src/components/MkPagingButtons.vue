<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePagingButtons :min="min" :current="current" :max="max" :buttonRanges="buttonRanges" :prevDotVisible="prevDotVisible" :nextDotVisible="nextDotVisible" :rootClass="$style.root" :buttonsClass="$style.buttons" :headTailClass="$style.headTailButtons" :onPage="onNumberButtonClicked"/>
</template>

<script setup lang="ts">
import VunePagingButtonsView from './vune/MkPagingButtons.vune';

import { computed, toRefs } from 'vue';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VunePagingButtons = createVuneWebHost(VunePagingButtonsView);

const min = 1;

const emit = defineEmits<{
	(ev: 'pageChanged', pageNumber: number): void;
}>();

const props = defineProps<{
	current: number;
	max: number;
	buttonCount: number;
}>();

const { current, max } = toRefs(props);

const buttonCount = computed(() => Math.min(max.value, props.buttonCount));
const buttonCountHalf = computed(() => Math.floor(buttonCount.value / 2));
const buttonCountStart = computed(() => Math.min(Math.max(min, current.value - buttonCountHalf.value), max.value - buttonCount.value + 1));
const buttonRanges = computed(() => Array.from({ length: buttonCount.value }, (_, i) => buttonCountStart.value + i));

const prevDotVisible = computed(() => (current.value - 1 > buttonCountHalf.value) && (max.value > buttonCount.value));
const nextDotVisible = computed(() => (current.value < max.value - buttonCountHalf.value) && (max.value > buttonCount.value));

function onNumberButtonClicked(pageNumber: number) {
	emit('pageChanged', pageNumber);
}
</script>

<style module lang="scss">
.root {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 24px;

	button {
		border-radius: 9999px;
		min-width: 2.5em;
		min-height: 2.5em;
		max-width: 2.5em;
		max-height: 2.5em;
		padding: 4px;
	}
}

.buttons {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
}

.headTailButtons {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;

	span {
		font-size: 0.75em;
	}
}
</style>
