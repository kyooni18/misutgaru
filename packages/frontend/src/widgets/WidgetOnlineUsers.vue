<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneOnlineUsers :onlineUsersCount="onlineUsersCount" :transparent="widgetProps.transparent" :classes="$style"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneOnlineUsers from './vune/WidgetOnlineUsers.vune';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { useInterval } from '@@/js/use-interval.js';
import { i18n } from '@/i18n.js';

const name = 'onlineUsers';

const widgetPropsDef = {
	transparent: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.transparent,
		default: true,
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

const onlineUsersCount = ref(0);

const tick = () => {
	misskeyApiGet('get-online-users-count').then(res => {
		onlineUsersCount.value = res.count;
	});
};

useInterval(tick, 1000 * 15, {
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	text-align: center;

	&.pad {
		padding: 16px 0;
	}
}

.text {
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}
</style>
