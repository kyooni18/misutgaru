<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFormSplit :minWidth="minWidth" :rootClass="$style.root"><slot></slot></VuneFormSplit>
</template>

<script lang="ts" setup>
import VuneFormSplit from './vune/split.vune';
import { provide } from 'vue';

const props = withDefaults(defineProps<{
	minWidth?: number;
}>(), {
	minWidth: 210,
});

provide('splited', true);

const minWidth = props.minWidth;
</script>

<style lang="scss" module>
.root {
	display: grid;
		grid-gap: 12px;
}
</style>
