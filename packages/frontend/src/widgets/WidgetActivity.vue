<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneWidgetActivity :showHeader="widgetProps.showHeader" :transparent="widgetProps.transparent" :view="widgetProps.view" :fetching="fetching" :activity="activity" :onToggleView="toggleView"/>
</template>

<script lang="ts" setup>
import VuneWidgetActivity from './vune/WidgetActivity.vune?vue-host';
import { ref } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentProps, WidgetComponentEmits, WidgetComponentExpose } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';

const $i = ensureSignin();

const name = 'activity';

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

const activity = ref<{
	total: number;
	notes: number;
	replies: number;
	renotes: number;
}[] | null>(null);
const fetching = ref(true);

const toggleView = () => {
	if (widgetProps.view === 1) {
		widgetProps.view = 0;
	} else {
		widgetProps.view++;
	}
	save();
};

misskeyApiGet('charts/user/notes', {
	userId: $i.id,
	span: 'day',
	limit: 7 * 21,
}).then(res => {
	activity.value = res.diffs.normal.map((_, i) => ({
		total: res.diffs.normal[i] + res.diffs.reply[i] + res.diffs.renote[i],
		notes: res.diffs.normal[i],
		replies: res.diffs.reply[i],
		renotes: res.diffs.renote[i],
	}));
	fetching.value = false;
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
