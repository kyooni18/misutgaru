<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneWidgetsColumn
	:column="column"
	:isStacked="isStacked"
	:edit="edit"
	:menu="menu"
	:onAddWidget="addWidget"
	:onRemoveWidget="removeWidget"
	:onUpdateWidget="updateWidget"
	:onUpdateWidgets="updateWidgets"
	:onExitEdit="exitEdit"
/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import type { Column } from '@/deck.js';
import type { Widget } from '@/components/MkWidgets.vue';
import { addColumnWidget, removeColumnWidget, setColumnWidgets, updateColumnWidget } from '@/deck.js';
import { i18n } from '@/i18n.js';
import VuneWidgetsColumn from './vune/widgets-column.vune?vue-host';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const edit = ref(false);

function addWidget(widget: Widget) { addColumnWidget(props.column.id, widget); }

function removeWidget(widget: Widget) { removeColumnWidget(props.column.id, widget); }

function updateWidget(widget: { id: Widget['id']; data: Widget['data'] }) { updateColumnWidget(props.column.id, widget.id, widget.data); }

function updateWidgets(widgets: Widget[]) { setColumnWidgets(props.column.id, widgets); }

function exitEdit() { edit.value = false; }

function func() { edit.value = !edit.value; }

const menu = [{ icon: 'ti ti-pencil', text: i18n.ts.editWidgets, action: func }];
</script>
