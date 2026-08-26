<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneEmojiLogs :logs="logs" :filteredLogs="filteredLogs" :showingSuccessLogs="showingSuccessLogs" :settings="setupGrid()" :onToggleSuccess="value => showingSuccessLogs = value"/>
</template>

<script setup lang="ts">
import VuneEmojiLogs from './vune/custom-emojis-manager.logs.vune';
import { computed, ref, toRefs } from 'vue';
import { i18n } from '@/i18n.js';
import { copyGridDataToClipboard } from '@/components/grid/grid-utils.js';

import type { RequestLogItem } from '@/pages/admin/custom-emojis-manager.impl.js';
import type { GridSetting } from '@/components/grid/grid.js';

function setupGrid(): GridSetting {
	return {
		row: {
			showNumber: false,
			selectable: false,
			contextMenuFactory: (row, context) => {
				return [
					{
						type: 'button',
						text: i18n.ts._customEmojisManager._gridCommon.copySelectionRows,
						icon: 'ti ti-copy',
						action: () => copyGridDataToClipboard(logs, context),
					},
				];
			},
		},
		cols: [
			{ bindTo: 'failed', title: 'failed', type: 'boolean', editable: false, width: 50 },
			{ bindTo: 'url', icon: 'ti-icons', type: 'image', editable: false, width: 'auto' },
			{ bindTo: 'name', title: 'name', type: 'text', editable: false, width: 140 },
			{ bindTo: 'error', title: 'log', type: 'text', editable: false, width: 'auto' },
		],
		cells: {
			contextMenuFactory: (col, row, value, context) => {
				return [
					{
						type: 'button',
						text: i18n.ts._customEmojisManager._gridCommon.copySelectionRanges,
						icon: 'ti ti-copy',
						action: () => copyGridDataToClipboard(logs, context),
					},
				];
			},
		},
	};
}

const props = defineProps<{
	logs: RequestLogItem[];
}>();

const { logs } = toRefs(props);
const showingSuccessLogs = ref<boolean>(false);

const filteredLogs = computed(() => {
	const forceShowing = showingSuccessLogs.value;
	return logs.value.filter((log) => forceShowing || log.failed);
});
</script>
