<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneWidgetAiscript
	:showHeader="widgetProps.showHeader"
	:script="widgetProps.script"
	:logs="logs"
	:onScriptInput="onScriptInput"
	:onRun="run"
/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { Interpreter, Parser, utils } from '@syuilo/aiscript';
import { useWidgetPropsManager } from './widget.js';
import VuneWidgetAiscript from './vune/WidgetAiscript.vune';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import type { Value } from '@syuilo/aiscript/interpreter/value.js';
import * as os from '@/os.js';
import { aiScriptReadline, createAiScriptEnv } from '@/aiscript/api.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { genId } from '@/utility/id.js';

const name = 'aiscript';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
		default: true,
	},
	script: {
		type: 'string',
		label: i18n.ts.script,
		multiline: true,
		default: '(1 + 1)',
		hidden: true,
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

const parser = new Parser();

const logs = ref<{
	id: string;
	text: string;
	print: boolean;
}[]>([]);

function onScriptInput(value: string) {
	widgetProps.script = value;
}

const run = async () => {
	logs.value = [];
	const aiscript = new Interpreter(createAiScriptEnv({
		storageKey: 'widget',
		token: $i?.token,
	}), {
		in: aiScriptReadline,
		out: (value) => {
			logs.value.push({
				id: genId(),
				text: value.type === 'str' ? value.value : utils.valToString(value),
				print: true,
			});
		},
		log: (type, params) => {
			switch (type) {
				case 'end': logs.value.push({
					id: genId(),
					text: utils.valToString(params.val as Value, true),
					print: false,
				}); break;
				default: break;
			}
		},
	});

	let ast;
	try {
		ast = parser.parse(widgetProps.script);
	} catch (err) {
		os.alert({ type: 'error', text: 'Syntax error :(' });
		return;
	}
	try {
		await aiscript.exec(ast);
	} catch (err) {
		os.alert({
			type: 'error',
			text: err instanceof Error ? err.message : String(err),
		});
	}
};

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
