<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneFormFile :fileName="fileName" :friendlyFileName="friendlyFileName" :onSelect="selectButton"/>
</template>

<script setup lang="ts">
import * as Misskey from 'misskey-js';
import { computed, ref } from 'vue';
import MkFormFile from './vune/MkForm.file.vune';
import { i18n } from '@/i18n.js';
import { selectFile } from '@/utility/drive.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneFormFile = createVuneWebHost(MkFormFile);

const props = defineProps<{
	fileId?: string | null;
	validate?: (file: Misskey.entities.DriveFile) => Promise<boolean>;
}>();
const emit = defineEmits<{ (ev: 'update', result: Misskey.entities.DriveFile): void }>();
const fileUrl = ref('');
const fileName = ref<string>('');
const friendlyFileName = computed<string>(() => fileName.value || fileUrl.value || i18n.ts.fileNotSelected);
if (props.fileId) {
	misskeyApi('drive/files/show', { fileId: props.fileId }).then((apiRes) => {
		fileName.value = apiRes.name;
		fileUrl.value = apiRes.url;
	});
}

function selectButton() {
	selectFile({ anchorElement: window.document.activeElement, multiple: false }).then(async (file) => {
		if (!file) return;
		if (props.validate && !await props.validate(file)) return;
		emit('update', file);
		fileName.value = file.name;
		fileUrl.value = file.url;
	});
}
</script>
