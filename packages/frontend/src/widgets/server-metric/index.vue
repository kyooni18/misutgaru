<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneServerMetric
	:showHeader="widgetProps.showHeader"
	:transparent="widgetProps.transparent"
	:view="widgetProps.view"
	:connection="connection"
	:meta="meta"
	:onToggleView="toggleView"
/>
</template>

<script lang="ts" setup>
import { onUnmounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneServerMetric from './vune/index.vune';
import { useWidgetPropsManager } from '../widget.js';
import type { WidgetComponentProps, WidgetComponentEmits, WidgetComponentExpose } from '../widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';

const name = 'serverMetric';

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
onUnmounted(() => {
	connection.dispose();
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
