<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNetHost :viewBoxX="viewBoxX" :viewBoxY="viewBoxY" :inPolygonPoints="inPolygonPoints" :outPolygonPoints="outPolygonPoints" :inPolylinePoints="inPolylinePoints" :outPolylinePoints="outPolylinePoints" :inHeadX="inHeadX" :inHeadY="inHeadY" :outHeadX="outHeadX" :outHeadY="outHeadY" :inRecent="inRecent" :outRecent="outRecent"/>
</template>

<script lang="ts" setup>
import VuneNet from './vune/net.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { genId } from '@/utility/id.js';

const VuneNetHost = createVuneWebHost(VuneNet);

const props = defineProps<{
	connection: Misskey.IChannelConnection<Misskey.Channels['serverStats']>,
	meta: Misskey.entities.ServerInfoResponse
}>();

const viewBoxX = ref<number>(50);
const viewBoxY = ref<number>(30);
const stats = ref<Misskey.entities.ServerStats[]>([]);
const inPolylinePoints = ref<string>('');
const outPolylinePoints = ref<string>('');
const inPolygonPoints = ref<string>('');
const outPolygonPoints = ref<string>('');
const inHeadX = ref<number>();
const inHeadY = ref<number>();
const outHeadX = ref<number>();
const outHeadY = ref<number>();
const inRecent = ref<number>(0);
const outRecent = ref<number>(0);

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

	const inPeak = Math.max(1024 * 64, Math.max(...stats.value.map(s => s.net.rx)));
	const outPeak = Math.max(1024 * 64, Math.max(...stats.value.map(s => s.net.tx)));

	let inPolylinePointsStats = stats.value.map((s, i) => [viewBoxX.value - ((stats.value.length - 1) - i), (1 - (s.net.rx / inPeak)) * viewBoxY.value]);
	let outPolylinePointsStats = stats.value.map((s, i) => [viewBoxX.value - ((stats.value.length - 1) - i), (1 - (s.net.tx / outPeak)) * viewBoxY.value]);
	inPolylinePoints.value = inPolylinePointsStats.map(xy => `${xy[0]},${xy[1]}`).join(' ');
	outPolylinePoints.value = outPolylinePointsStats.map(xy => `${xy[0]},${xy[1]}`).join(' ');

	inPolygonPoints.value = `${viewBoxX.value - (stats.value.length - 1)},${viewBoxY.value} ${inPolylinePoints.value} ${viewBoxX.value},${viewBoxY.value}`;
	outPolygonPoints.value = `${viewBoxX.value - (stats.value.length - 1)},${viewBoxY.value} ${outPolylinePoints.value} ${viewBoxX.value},${viewBoxY.value}`;

	inHeadX.value = inPolylinePointsStats.at(-1)![0];
	inHeadY.value = inPolylinePointsStats.at(-1)![1];
	outHeadX.value = outPolylinePointsStats.at(-1)![0];
	outHeadY.value = outPolylinePointsStats.at(-1)![1];

	inRecent.value = connStats.net.rx;
	outRecent.value = connStats.net.tx;
}

function onStatsLog(statsLog: Misskey.entities.ServerStatsLog) {
	for (const revStats of statsLog.toReversed()) {
		onStats(revStats);
	}
}
</script>

<style lang="scss">
.oxxrhrto {
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
