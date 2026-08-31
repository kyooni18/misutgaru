<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneTutorialNote
	:phase="phase"
	:exampleNote="exampleNote"
	:onceReacted="onceReacted"
	:classes="$style"
	:onReaction="addReaction"
	:onRemoveReaction="removeReaction"
/>
</template>

<script setup lang="ts">
import * as Misskey from 'misskey-js';
import VuneTutorialNote from './vune/MkTutorialDialog.Note.vune?vue-host';
import { ref, reactive } from 'vue';
import { i18n } from '@/i18n.js';
import { globalEvents } from '@/events.js';
import { $i } from '@/i.js';
import { genId } from '@/utility/id.js';

const props = defineProps<{
	phase: 'aboutNote' | 'howToReact';
}>();

const emit = defineEmits<{
	(ev: 'reacted'): void;
}>();

const exampleNote = reactive<Misskey.entities.Note>({
	id: '0000000000',
	createdAt: '2019-04-14T17:30:49.181Z',
	userId: '0000000001',
	user: {
		id: '0000000001',
		name: '藍',
		username: 'ai',
		host: null,
		avatarDecorations: [],
		avatarUrl: '/client-assets/tutorial/ai.webp',
		avatarBlurhash: 'eiKmhHIByXxZ~qWXs:-pR*NbR*s:xuRjoL-oR*WCt6WWf6WVf6oeWB',
		isBot: false,
		isCat: true,
		emojis: {},
		onlineStatus: 'unknown',
		badgeRoles: [],
	},
	text: 'just setting up my msky',
	cw: null,
	visibility: 'public',
	localOnly: false,
	reactionAcceptance: null,
	renoteCount: 0,
	repliesCount: 1,
	reactionCount: 0,
	reactions: {},
	reactionEmojis: {},
	fileIds: [],
	files: [],
	replyId: null,
	renoteId: null,
});
const onceReacted = ref<boolean>(false);

function addReaction(emoji: string) {
	onceReacted.value = true;
	emit('reacted');
	doNotification(emoji);
}

function doNotification(emoji: string): void {
	if (!$i || !emoji) return;

	const notification: Misskey.entities.Notification = {
		id: genId(),
		createdAt: new Date().toUTCString(),
		type: 'reaction',
		reaction: emoji,
		user: $i,
		userId: $i.id,
		note: exampleNote,
	};

	globalEvents.emit('clientNotification', notification);
}

function removeReaction(emoji: string) {
	delete exampleNote.reactions[emoji];
	exampleNote.myReaction = undefined;
}
</script>

<style lang="scss" module>
.exampleNoteRoot {
	border-radius: var(--MI-radius);
	border: var(--MI_THEME-panelBorder);
	background: var(--MI_THEME-panel);
}

.divider {
	height: 1px;
	background: var(--MI_THEME-divider);
}
</style>
