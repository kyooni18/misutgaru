<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSystemWebhookItem :entity="entity" :onEdit="onEditClick" :onDelete="onDeleteClick"/>
</template>

<script lang="ts" setup>
import { entities } from 'misskey-js';
import { toRefs } from 'vue';
import VuneSystemWebhookItem from './vune/system-webhook.item.vune.js';

const emit = defineEmits<{
	(ev: 'edit', value: entities.SystemWebhook): void;
	(ev: 'delete', value: entities.SystemWebhook): void;
}>();

const props = defineProps<{
	entity: entities.SystemWebhook;
}>();

const { entity } = toRefs(props);

function onEditClick() {
	emit('edit', entity.value);
}

function onDeleteClick() {
	emit('delete', entity.value);
}

</script>

<style module lang="scss">
.icon {
	margin-right: 0.75em;
	flex-shrink: 0;
	text-align: center;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}
</style>
