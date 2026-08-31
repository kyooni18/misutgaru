<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneWidgetNotifications
	:showHeader="widgetProps.showHeader"
	:height="widgetProps.height"
	:excludeTypes="widgetProps.excludeTypes"
	:onConfigure="configureNotification"
/>
</template>

<script lang="ts" setup>
import { useWidgetPropsManager } from './widget.js';
import VuneWidgetNotifications from './vune/WidgetNotifications.vune?vue-host';
import type { notificationTypes as notificationTypes_typeReferenceOnly } from 'misskey-js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const name = 'notifications';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
		default: true,
	},
	height: {
		type: 'number',
		label: i18n.ts.height,
		default: 300,
	},
	excludeTypes: {
		type: 'array',
		hidden: true,
		default: [] as (typeof notificationTypes_typeReferenceOnly[number])[],
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

const configureNotification = async () => {
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkNotificationSelectWindow.vue').then(x => x.default), {
		excludeTypes: widgetProps.excludeTypes,
	}, {
		done: async (res) => {
			const { excludeTypes } = res;
			widgetProps.excludeTypes = excludeTypes;
			save();
		},
		closed: () => dispose(),
	});
};

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
