<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeSortOrderEditor
	:currentOrders="nativeOrders"
	:classes="$style"
	:onToggle="onToggleSortOrderButtonClicked"
	:onAdd="onAddSortOrderButtonClicked"
	:onRemove="onRemoveSortOrderButtonClicked"
/>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, toRefs } from 'vue';
import MkSortOrderEditor from './vune/MkSortOrderEditor.vune';
import type { MenuItem } from '@/types/menu.js';
import type { SortOrder } from '@/components/MkSortOrderEditor.define.js';
import * as os from '@/os.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeSortOrderEditor = createVuneWebHost(MkSortOrderEditor);

const emit = defineEmits<{
	(ev: 'update', sortOrders: SortOrder<T>[]): void;
}>();

const props = defineProps<{
	baseOrderKeyNames: T[];
	currentOrders: SortOrder<T>[];
}>();

const { currentOrders } = toRefs(props);
const nativeOrders = computed(() => currentOrders.value.map(order => ({ ...order })));

function onToggleSortOrderButtonClicked(order: SortOrder<T>) {
	switch (order.direction) {
		case '+':
			order.direction = '-';
			break;
		case '-':
			order.direction = '+';
			break;
	}

	emitOrder(currentOrders.value);
}

function onAddSortOrderButtonClicked(ev: PointerEvent) {
	const menuItems: MenuItem[] = props.baseOrderKeyNames
		.filter(baseKey => !currentOrders.value.map(it => it.key).includes(baseKey))
		.map(it => {
			return {
				text: it,
				action: () => {
					emitOrder([...currentOrders.value, { key: it, direction: '+' }]);
				},
			};
		});
	os.contextMenu(menuItems, ev);
}

function onRemoveSortOrderButtonClicked(order: SortOrder<T>) {
	emitOrder(currentOrders.value.filter(it => it.key !== order.key));
}

function emitOrder(sortOrders: SortOrder<T>[]) {
	emit('update', sortOrders);
}

</script>

<style module lang="scss">
.sortOrderArea {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	justify-content: flex-start;
}

.sortOrderAreaTags {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	justify-content: flex-start;
	flex-wrap: wrap;
	gap: 8px;
}

.sortOrderAddButton {
	display: inline-flex;
	justify-content: center;
	align-items: center;
	padding: var(--MI-button-padding-y-small);
	margin-left: auto;
	border: thin solid var(--MI-button-border);
	border-radius: calc(1em + var(--MI-button-padding-y-small));
	background: var(--MI-button-surface);
	box-shadow: var(--MI-button-shadow);
	transition: background var(--MI-motion-duration-fast) var(--MI-motion-ease-standard), border-color var(--MI-motion-duration-fast) var(--MI-motion-ease-standard), box-shadow var(--MI-motion-duration-fast) var(--MI-motion-ease-standard);

	&:hover {
		background: var(--MI-button-surface-hover);
		border-color: var(--MI-button-border-hover);
	}

	&:active {
		background: var(--MI-button-surface-pressed);
		box-shadow: var(--MI-button-shadow-pressed);
	}
}

.sortOrderTag {
	user-select: none;
	cursor: pointer;
}
</style>
