<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeDigitalClock
	:transparent="widgetProps.transparent"
	:fontSize="widgetProps.fontSize"
	:showMs="widgetProps.showMs"
	:showLabel="widgetProps.showLabel"
	:tzAbbrev="tzAbbrev"
	:tzOffsetLabel="tzOffsetLabel"
	:rootClass="$style.root"
	:labelClass="$style.label"
	:hh="hh"
	:mm="mm"
	:ss="ss"
	:ms="ms"
	:showColon="showColon"
/>
</template>

<script lang="ts" setup>
import WidgetDigitalClock from './vune/WidgetDigitalClock.vune';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { timezones } from '@/utility/timezones.js';
import { i18n } from '@/i18n.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { defaultIdlingRenderScheduler } from '@/utility/idle-render.js';

const NativeDigitalClock = createVuneWebHost(WidgetDigitalClock);

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

const hh = ref('');
const mm = ref('');
const ss = ref('');
const ms = ref('');
const showColon = ref(false);
let prevSec: number | null = null;

watch(showColon, (value) => {
	if (!value) return;
	window.setTimeout(() => {
		showColon.value = false;
	}, 30);
});

const tick = (): void => {
	const now = new Date();
	now.setMinutes(now.getMinutes() + now.getTimezoneOffset() + tzOffset.value);
	hh.value = now.getHours().toString().padStart(2, '0');
	mm.value = now.getMinutes().toString().padStart(2, '0');
	ss.value = now.getSeconds().toString().padStart(2, '0');
	ms.value = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
	if (now.getSeconds() !== prevSec) showColon.value = true;
	prevSec = now.getSeconds();
};

tick();

onMounted(() => {
	defaultIdlingRenderScheduler.add(tick);
});

onUnmounted(() => {
	defaultIdlingRenderScheduler.delete(tick);
});

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
