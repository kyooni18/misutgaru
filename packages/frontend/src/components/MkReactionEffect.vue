<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneReactionEffect :reaction="props.reaction" :x="props.x" :y="props.y" :zIndex="zIndex" :up="up" :angle="angle" :rootClass="$style.root" :textClass="$style.text" :upClass="$style.up"/>
</template>

<script lang="ts" setup>
import VuneReactionEffect from './vune/MkReactionEffect.vune';
import { onMounted, ref } from 'vue';
import * as os from '@/os.js';

const props = withDefaults(defineProps<{
	reaction: string;
	x: number;
	y: number;
}>(), {
});

const emit = defineEmits<{
	(ev: 'end'): void;
}>();

const up = ref(false);
const zIndex = os.claimZIndex('middle');
const angle = (90 - (Math.random() * 180)) + 'deg';

onMounted(() => {
	window.setTimeout(() => {
		up.value = true;
	}, 10);

	window.setTimeout(() => {
		emit('end');
	}, 1100);
});
</script>

<style lang="scss" module>
.root {
	pointer-events: none;
	position: fixed;
	width: 128px;
	height: 128px;
}

.text {
	display: block;
	height: 1em;
	text-align: center;
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	margin: auto;
	color: var(--MI_THEME-accent);
	font-size: 18px;
	font-weight: bold;
	transform: translateY(-30px);
	will-change: opacity, transform;

	&.up {
		opacity: 0;
		transform: translateY(-50px) rotateZ(v-bind(angle));
	}
}
</style>
