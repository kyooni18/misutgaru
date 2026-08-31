<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="mk-vune-form-split" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }"><slot></slot></div>
</template>

<script lang="ts" setup>
import { provide } from 'vue';
import '@/components/vune/misskey-vune.scss';

const props = withDefaults(defineProps<{
	minWidth?: number;
}>(), {
	minWidth: 210,
});

provide('splited', true);

const minWidth = props.minWidth;
</script>
