<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneDiskHost :usage="usage" :total="total" :used="used" :available="available"/>
</template>

<script lang="ts" setup>
import VuneDisk from './vune/disk.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { computed } from 'vue';
import * as Misskey from 'misskey-js';

const VuneDiskHost = createVuneWebHost(VuneDisk);

const props = defineProps<{
	meta: Misskey.entities.ServerInfoResponse;
}>();

const usage = computed(() => props.meta.fs.used / props.meta.fs.total);
const total = computed(() => props.meta.fs.total);
const used = computed(() => props.meta.fs.used);
const available = computed(() => props.meta.fs.total - props.meta.fs.used);
</script>

<style lang="scss">
.zbwaqsat {
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
