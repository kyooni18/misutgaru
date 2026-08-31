<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneDriveFileNotes :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { ref, computed, markRaw } from 'vue';
import { i18n } from '@/i18n.js';
import VuneDriveFileNotes from './vune/drive.file.notes.view.vune?vue-host';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	fileId: string;
}>();

const realFileId = computed(() => props.fileId);

const paginator = markRaw(new Paginator('drive/files/attached-notes', {
	limit: 10,
	params: {
		fileId: realFileId.value,
	},
}));
</script>
