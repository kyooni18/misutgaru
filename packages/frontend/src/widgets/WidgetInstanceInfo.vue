<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneWidgetInstanceInfo/>
</template>

<script lang="ts" setup>
import { useWidgetPropsManager } from './widget.js';
import VuneWidgetInstanceInfo from './vune/WidgetInstanceInfo.vune';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';

const name = 'instanceInfo';
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
