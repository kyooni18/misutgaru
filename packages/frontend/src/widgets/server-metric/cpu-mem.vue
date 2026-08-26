<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneCpuMem :viewBoxX="viewBoxX" :viewBoxY="viewBoxY" :cpuGradientId="cpuGradientId" :cpuMaskId="cpuMaskId" :memGradientId="memGradientId" :memMaskId="memMaskId" :cpuPolylinePoints="cpuPolylinePoints" :memPolylinePoints="memPolylinePoints" :cpuPolygonPoints="cpuPolygonPoints" :memPolygonPoints="memPolygonPoints" :cpuHeadX="cpuHeadX" :cpuHeadY="cpuHeadY" :memHeadX="memHeadX" :memHeadY="memHeadY" :cpuP="cpuP" :memP="memP"/>
</template>

<script lang="ts" setup>
import VuneCpuMem from './vune/cpu-mem.vune';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { genId } from '@/utility/id.js';

const props = defineProps<{
	connection: Misskey.IChannelConnection<Misskey.Channels['serverStats']>,
	meta: Misskey.entities.ServerInfoResponse
}>();

const viewBoxX = ref<number>(50);
const viewBoxY = ref<number>(30);
const stats = ref<Misskey.entities.ServerStats[]>([]);
const cpuGradientId = genId();
const cpuMaskId = genId();
const memGradientId = genId();
const memMaskId = genId();
const cpuPolylinePoints = ref<string>('');
const memPolylinePoints = ref<string>('');
const cpuPolygonPoints = ref<string>('');
const memPolygonPoints = ref<string>('');
const cpuHeadX = ref<number>();
const cpuHeadY = ref<number>();
const memHeadX = ref<number>();
const memHeadY = ref<number>();
const cpuP = ref<string>('');
const memP = ref<string>('');

onMounted(() => {
	props.connection.on('stats', onStats);
	props.connection.on('statsLog', onStatsLog);
	props.connection.send('requestLog', {
		id: genId(),
		length: 50,
	});
});

onBeforeUnmount(() => {
	props.connection.off('stats', onStats);
	props.connection.off('statsLog', onStatsLog);
});

function onStats(connStats: Misskey.entities.ServerStats) {
	stats.value.push(connStats);
	if (stats.value.length > 50) stats.value.shift();

	let cpuPolylinePointsStats = stats.value.map((s, i) => [viewBoxX.value - ((stats.value.length - 1) - i), (1 - s.cpu) * viewBoxY.value]);
	let memPolylinePointsStats = stats.value.map((s, i) => [viewBoxX.value - ((stats.value.length - 1) - i), (1 - (s.mem.active / props.meta.mem.total)) * viewBoxY.value]);
	cpuPolylinePoints.value = cpuPolylinePointsStats.map(xy => `${xy[0]},${xy[1]}`).join(' ');
	memPolylinePoints.value = memPolylinePointsStats.map(xy => `${xy[0]},${xy[1]}`).join(' ');

	cpuPolygonPoints.value = `${viewBoxX.value - (stats.value.length - 1)},${viewBoxY.value} ${cpuPolylinePoints.value} ${viewBoxX.value},${viewBoxY.value}`;
	memPolygonPoints.value = `${viewBoxX.value - (stats.value.length - 1)},${viewBoxY.value} ${memPolylinePoints.value} ${viewBoxX.value},${viewBoxY.value}`;

	cpuHeadX.value = cpuPolylinePointsStats.at(-1)![0];
	cpuHeadY.value = cpuPolylinePointsStats.at(-1)![1];
	memHeadX.value = memPolylinePointsStats.at(-1)![0];
	memHeadY.value = memPolylinePointsStats.at(-1)![1];

	cpuP.value = (connStats.cpu * 100).toFixed(0);
	memP.value = (connStats.mem.active / props.meta.mem.total * 100).toFixed(0);
}

function onStatsLog(statsLog: Misskey.entities.ServerStatsLog) {
	for (const revStats of statsLog.toReversed()) {
		onStats(revStats);
	}
}
</script>

<style lang="scss">
.lcfyofjk {
	display: flex;

	> svg {
		display: block;
		padding: 10px;
		width: 50%;

		&:first-child {
			padding-right: 5px;
		}

		&:last-child {
			padding-left: 5px;
		}

		> text {
			font-size: 4.5px;
			fill: currentColor;

			> tspan {
				opacity: 0.5;
			}
		}
	}
}
</style>
