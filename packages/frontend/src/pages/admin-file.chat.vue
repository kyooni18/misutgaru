<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAdminFileChat :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import VuneAdminFileChat from './vune/admin-file.chat.view.vune.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	fileId: string;
}>();

const realFileId = computed(() => props.fileId);

const paginator = markRaw(new Paginator('drive/files/attached-chat-messages', {
	limit: 10,
	params: {
		fileId: realFileId.value,
	},
}));
</script>
