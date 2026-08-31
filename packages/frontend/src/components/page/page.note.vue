<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePageNote :block="block" :note="note" :rootClass="$style.root"/>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VunePageNote from './vune/page.note.vune?vue-host';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = defineProps<{
	block: Extract<Misskey.entities.PageBlock, { type: 'note' }>,
	page: Misskey.entities.Page,
}>();

const note = ref<Misskey.entities.Note | null>(null);

onMounted(() => {
	if (props.block.note == null) return;
	misskeyApi('notes/show', { noteId: props.block.note })
		.then(result => {
			note.value = result;
		});
});
</script>

<style lang="scss" module>
.root {
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
}
</style>
