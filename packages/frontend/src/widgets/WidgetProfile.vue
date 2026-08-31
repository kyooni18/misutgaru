<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneWidgetProfileHost :user="$i"/>
</template>

<script lang="ts" setup>
import { useWidgetPropsManager } from './widget.js';
import VuneWidgetProfile from './vune/WidgetProfile.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneWidgetProfileHost = createVuneWebHost(VuneWidgetProfile);
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { ensureSignin } from '@/i.js';

const $i = ensureSignin();
const name = 'profile';
const widgetPropsDef = {} satisfies FormWithDefault;
type WidgetProps = GetFormResultType<typeof widgetPropsDef>;
const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const { configure } = useWidgetPropsManager(name, widgetPropsDef, props, emit);

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
