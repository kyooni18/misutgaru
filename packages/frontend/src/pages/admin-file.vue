<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAdminFile :fetcher="_fetch_" :onResolved="onResolved"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneAdminFile from './vune/admin-file.vune.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const props = defineProps<{
	fileId: string,
}>();

function _fetch_() {
	return Promise.all([
		misskeyApi('drive/files/show', { fileId: props.fileId }),
		misskeyApi('admin/drive/show-file', { fileId: props.fileId }),
	]).then((result) => ({
		file: result[0],
		info: result[1],
	}));
}

const file = ref<Misskey.entities.DriveFile | null>(null);
function onResolved(result: { file: Misskey.entities.DriveFile }) {
	file.value = result.file;
}


definePage(() => ({
	title: file.value ? `${i18n.ts.file}: ${file.value.name}` : i18n.ts.file,
	icon: 'ti ti-file',
}));
</script>
