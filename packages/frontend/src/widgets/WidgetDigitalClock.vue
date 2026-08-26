<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneDigitalClock :transparent="widgetProps.transparent" :fontSize="widgetProps.fontSize" :showMs="widgetProps.showMs" :showLabel="widgetProps.showLabel" :tzAbbrev="tzAbbrev" :tzOffset="tzOffset" :tzOffsetLabel="tzOffsetLabel" :rootClass="$style.root" :labelClass="$style.label"/>
</template>

<script lang="ts" setup>
import VuneDigitalClock from './vune/WidgetDigitalClock.vune';
import { computed } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { timezones } from '@/utility/timezones.js';
import { i18n } from '@/i18n.js';

const name = 'digitalClock';

const widgetPropsDef = {
	transparent: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.transparent,
		default: false,
	},
	fontSize: {
		type: 'number',
		label: i18n.ts.fontSize,
		default: 1.5,
		step: 0.1,
	},
	showMs: {
		type: 'boolean',
		label: i18n.ts._widgetOptions._clock.showMs,
		default: true,
	},
	showLabel: {
		type: 'boolean',
		label: i18n.ts._widgetOptions._clock.showLabel,
		default: true,
	},
	timezone: {
		type: 'enum',
		label: i18n.ts._widgetOptions._clock.timezone,
		default: null,
		enum: [...timezones.map((tz) => ({
			label: tz.name,
			value: tz.name.toLowerCase(),
		})), {
			label: i18n.ts.auto,
			value: null,
		}],
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const tzAbbrev = computed(() => (widgetProps.timezone === null
	? timezones.find((tz) => tz.name.toLowerCase() === Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase())?.abbrev
	: timezones.find((tz) => tz.name.toLowerCase() === widgetProps.timezone)?.abbrev) ?? '?');

const tzOffset = computed(() => widgetProps.timezone === null
	? 0 - new Date().getTimezoneOffset()
	: timezones.find((tz) => tz.name.toLowerCase() === widgetProps.timezone)?.offset ?? 0);

const tzOffsetLabel = computed(() => (tzOffset.value >= 0 ? '+' : '-') + Math.floor(tzOffset.value / 60).toString().padStart(2, '0') + ':' + (tzOffset.value % 60).toString().padStart(2, '0'));

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	padding: 16px 0;
	text-align: center;
}

.label {
	font-size: 65%;
	opacity: 0.7;
}
</style>
