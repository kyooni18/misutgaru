<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneTutorialSensitive
	:exampleNote="exampleNote"
	:onceSucceeded="onceSucceeded"
	:onFileChangeSensitive="doSucceeded"
/>
</template>

<script setup lang="ts">
import * as Misskey from 'misskey-js';
import { ref, reactive } from 'vue';
import VuneTutorialSensitive from './vune/MkTutorialDialog.Sensitive.vune?vue-host';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';

const emit = defineEmits<{
	(ev: 'succeeded'): void;
}>();

const onceSucceeded = ref<boolean>(false);

function doSucceeded(fileId: string, to: boolean) {
	if (fileId === exampleNote.fileIds?.[0] && to) {
		onceSucceeded.value = true;
		emit('succeeded');
	}
}

const exampleNote = reactive<Misskey.entities.Note>({
	id: '0000000000',
	createdAt: '2019-04-14T17:30:49.181Z',
	userId: '0000000001',
	user: $i!,
	text: i18n.ts._initialTutorial._howToMakeAttachmentsSensitive._exampleNote.note,
	cw: null,
	visibility: 'public',
	localOnly: false,
	reactionAcceptance: null,
	renoteCount: 0,
	repliesCount: 1,
	reactionCount: 0,
	reactions: {},
	reactionEmojis: {},
	fileIds: ['0000000002'],
	files: [{
		id: '0000000002',
		createdAt: '2019-04-14T17:30:49.181Z',
		name: 'natto_failed.webp',
		type: 'image/webp',
		md5: 'c44286cf152d0740be0ce5ad45ea85c3',
		size: 827532,
		isSensitive: false,
		blurhash: 'LXNA3TD*XAIA%1%M%gt7.TofRioz',
		properties: {
			width: 256,
			height: 256,
		},
		url: '/client-assets/tutorial/natto_failed.webp',
		thumbnailUrl: '/client-assets/tutorial/natto_failed.webp',
		comment: null,
		folderId: null,
		folder: null,
		userId: null,
		user: null,
	}],
	replyId: null,
	renoteId: null,
});

</script>
