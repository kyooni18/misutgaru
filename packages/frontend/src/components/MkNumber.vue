<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span>{{ number(Math.floor(tweened.number)) }}</span>
</template>

<script lang="ts" setup>
import { onUnmounted, reactive, watch } from 'vue';
import { Animation } from 'vune-ui';
import number from '@/filters/number.js';
import { vuneMotion, type MotionHandle } from '@/vune/motion.js';

const props = defineProps<{
	value: number;
}>();

const tweened = reactive({
	number: 0,
});

let motion: MotionHandle | null = null;

watch(() => props.value, (to) => {
	// Share Vune's single animation clock instead of starting one rAF loop per
	// number. Retarget from the currently displayed value so rapid updates stay
	// continuous instead of snapping back to the previous prop value.
	motion?.cancel();
	motion = vuneMotion.animateNumber(
		tweened.number,
		to,
		Animation.linear(0.5),
		value => { tweened.number = value; },
	);
}, {
	immediate: true,
});

onUnmounted(() => motion?.cancel());
</script>
