<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeChartLegend :items="items" :type="type" :onItemClick="onClick"/>
</template>

<script lang="ts" setup>
import { shallowRef } from 'vue';
import { Chart } from 'chart.js';
import type { LegendItem } from 'chart.js';
import VuneChartLegend from './vune/MkChartLegend.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeChartLegend = createVuneWebHost(VuneChartLegend);

const chart = shallowRef<Chart>();
const type = shallowRef<string>();
const items = shallowRef<LegendItem[]>([]);

function update(_chart: Chart, _items: LegendItem[]) {
	chart.value = _chart,
	items.value = _items;
	if ('type' in _chart.config) type.value = _chart.config.type;
}

function onClick(item: LegendItem) {
	if (chart.value == null) return;
	if (type.value === 'pie' || type.value === 'doughnut') {
		// Pie and doughnut charts only have a single dataset and visibility is per item
		if (item.index != null) chart.value.toggleDataVisibility(item.index);
	} else {
		if (item.datasetIndex != null) chart.value.setDatasetVisibility(item.datasetIndex, !chart.value.isDatasetVisible(item.datasetIndex));
	}
	chart.value.update();
}

defineExpose({
	update,
});
</script>
