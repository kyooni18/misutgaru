<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneServerRules
	:serverRules="serverRules"
	:classes="$style"
	:onUpdateRules="updateRules"
	:onUpdateText="updateRuleText"
	:onRemove="remove"
	:onAdd="add"
	:onSave="save"
/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneServerRules from './vune/server-rules.vune';
import * as os from '@/os.js';
import { fetchInstance, instance } from '@/instance.js';

const serverRules = ref<{ text: string; id: string; }[]>(instance.serverRules.map(text => ({ text, id: Math.random().toString() })));

function updateRules(rules: { text: string; id: string }[]) {
	serverRules.value = rules;
}

function updateRuleText(index: number, value: string) {
	if (serverRules.value[index]) serverRules.value[index].text = value;
}

async function save() {
	await os.apiWithDialog('admin/update-meta', {
		serverRules: serverRules.value.map(r => r.text),
	});
	fetchInstance(true);
}

function add(): void {
	serverRules.value.push({ text: '', id: Math.random().toString() });
}

function remove(id: string): void {
	serverRules.value = serverRules.value.filter(r => r.id !== id);
}
</script>

<style lang="scss" module>
.item {
	display: block;
	color: var(--MI_THEME-navFg);
}

.itemHeader {
	display: flex;
	margin-bottom: 8px;
	align-items: center;
}

.itemHandle {
	display: flex;
	width: 40px;
	height: 40px;
	align-items: center;
	justify-content: center;
	cursor: move;
}

.itemNumber {
	display: flex;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
	font-size: 14px;
	font-weight: bold;
	width: 28px;
	height: 28px;
	align-items: center;
	justify-content: center;
	border-radius: 999px;
	margin-right: 8px;
}

.itemEdit {
	width: 100%;
	max-width: 100%;
	min-width: 100%;
}

.itemRemove {
	width: 40px;
	height: 40px;
	color: var(--MI_THEME-error);
	margin-left: auto;
	border-radius: 6px;

	&:hover {
		background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
	}
}

.commands {
	display: flex;
	gap: 16px;
}
</style>
