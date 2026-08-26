<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeMkNumber :value="tweened.number"/>
</template>

<script lang="ts" setup>
import VuneMkNumber from './vune/MkNumber.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { onUnmounted, reactive, watch } from 'vue';
import { Animation } from 'vune-ui';
import number from '@/filters/number.js';
import { vuneMotion } from '@/vune/motion.js';
import type { MotionHandle } from '@/vune/motion.js';

const NativeMkNumber = createVuneWebHost(VuneMkNumber);

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
