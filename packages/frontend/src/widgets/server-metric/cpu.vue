<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneCpuHost :usage="usage" :meta="meta"/>
</template>

<script lang="ts" setup>
import VuneCpu from './vune/cpu.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as Misskey from 'misskey-js';

const VuneCpuHost = createVuneWebHost(VuneCpu);

const props = defineProps<{
	connection: Misskey.IChannelConnection<Misskey.Channels['serverStats']>,
	meta: Misskey.entities.ServerInfoResponse
}>();

const usage = ref<number>(0);

function onStats(stats: Misskey.entities.ServerStats) {
	usage.value = stats.cpu;
}

onMounted(() => {
	props.connection.on('stats', onStats);
});

onBeforeUnmount(() => {
	props.connection.off('stats', onStats);
});
</script>

<style lang="scss">
.vrvdvrys {
	display: flex;
	padding: 16px;

	> .pie {
		height: 82px;
		flex-shrink: 0;
		margin-right: 16px;
	}

	> div {
		flex: 1;

		> p {
			margin: 0;
			font-size: 0.8em;

			&:first-child {
				font-weight: bold;
				margin-bottom: 4px;

				> i {
					margin-right: 4px;
				}
			}
		}
	}
}
</style>
