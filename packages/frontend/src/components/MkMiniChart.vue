<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeMiniChart :viewBoxX="viewBoxX" :viewBoxY="viewBoxY" :gradientId="gradientId" :color="color" :polygonPoints="polygonPoints" :polylinePoints="polylinePoints" :headX="headX" :headY="headY" :className="chartClass"/>
</template>

<script lang="ts" setup>
import VuneMiniChart from './vune/MkMiniChart.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { computed, useAttrs, watch, ref } from 'vue';
import { genId } from '@/utility/id.js';
import { themeManager } from '@/theme.js';
import tinycolor from 'tinycolor2';
import { useInterval } from '@@/js/use-interval.js';

const NativeMiniChart = createVuneWebHost(VuneMiniChart);

const props = defineProps<{
	src: number[];
}>();

const attrs = useAttrs();
const chartClass = computed(() => typeof attrs.class === 'string' ? attrs.class : undefined);

const viewBoxX = 50;
const viewBoxY = 50;
const gradientId = genId();
const polylinePoints = ref('');
const polygonPoints = ref('');
const headX = ref<number | null>(null);
const headY = ref<number | null>(null);
const accent = tinycolor(themeManager.currentCompiledTheme!.accent);
const color = accent.toRgbString();

function draw(): void {
	const stats = props.src.slice().reverse();
	const peak = Math.max.apply(null, stats) || 1;

	const _polylinePoints = stats.map((n, i) => [
		i * (viewBoxX / (stats.length - 1)),
		(1 - (n / peak)) * viewBoxY,
	]);

	polylinePoints.value = _polylinePoints.map(xy => `${xy[0]},${xy[1]}`).join(' ');

	polygonPoints.value = `0,${ viewBoxY } ${ polylinePoints.value } ${ viewBoxX },${ viewBoxY }`;

	headX.value = _polylinePoints.at(-1)![0];
	headY.value = _polylinePoints.at(-1)![1];
}

watch(() => props.src, draw, { immediate: true });

// Vueが何故かWatchを発動させない場合があるので
useInterval(draw, 1000, {
	immediate: false,
	afterMounted: true,
});
</script>
