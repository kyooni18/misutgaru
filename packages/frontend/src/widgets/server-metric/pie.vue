<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePie :value="value" :classes="$style"/>
</template>

<script lang="ts" setup>
import VunePie from './vune/pie.vune';

defineProps<{
	value: number;
}>();
</script>

<style lang="scss" module>
.root {
	display: block;
	height: 100%;
}

.circle {
	transform-origin: center;
	transform: rotate(-90deg);
	transition: stroke-dashoffset 0.5s ease;
}

.text {
	font-size: 0.15px;
	fill: currentColor;
}
</style>
