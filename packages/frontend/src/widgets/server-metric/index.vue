<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneServerMetricHost
	:showHeader="widgetProps.showHeader"
	:transparent="widgetProps.transparent"
	:view="widgetProps.view"
	:stats="stats"
	:meta="meta"
	:cpuGradientId="cpuGradientId"
	:cpuMaskId="cpuMaskId"
	:memGradientId="memGradientId"
	:memMaskId="memMaskId"
	:onToggleView="toggleView"
/>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneServerMetric from './vune/index.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { useWidgetPropsManager } from '../widget.js';
import type { WidgetComponentProps, WidgetComponentEmits, WidgetComponentExpose } from '../widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import { genId } from '@/utility/id.js';

const name = 'serverMetric';
const VuneServerMetricHost = createVuneWebHost(VuneServerMetric);

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
		default: true,
	},
	transparent: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.transparent,
		default: false,
	},
	view: {
		type: 'number',
		default: 0,
		hidden: true,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure, save } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const meta = ref<Misskey.entities.ServerInfoResponse | null>(null);
const stats = ref<Misskey.entities.ServerStats[]>([]);
const cpuGradientId = genId();
const cpuMaskId = genId();
const memGradientId = genId();
const memMaskId = genId();

misskeyApiGet('server-info', {}).then(res => {
	meta.value = res;
});

const toggleView = () => {
	if (widgetProps.view === 4) {
		widgetProps.view = 0;
	} else {
		widgetProps.view++;
	}
	save();
};

const connection = useStream().useChannel('serverStats');

function appendStats(next: Misskey.entities.ServerStats[]) {
	stats.value = [...stats.value, ...next].slice(-50);
}

function onStats(stat: Misskey.entities.ServerStats) {
	appendStats([stat]);
}

function onStatsLog(statsLog: Misskey.entities.ServerStatsLog) {
	appendStats(statsLog.toReversed());
}

onMounted(() => {
	connection.on('stats', onStats);
	connection.on('statsLog', onStatsLog);
	connection.send('requestLog', {
		id: genId(),
		length: 50,
	});
});

onUnmounted(() => {
	connection.off('stats', onStats);
	connection.off('statsLog', onStatsLog);
	connection.dispose();
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
