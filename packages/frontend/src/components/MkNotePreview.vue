<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNotePreview :text="text" :files="files" :poll="poll" :useCw="useCw" :cw="cw" :user="user" :showContent="showContent" :classes="$style" :onShowContent="(value: boolean) => showContent = value"/>
</template>

<script lang="ts" setup>
import VuneNotePreview from './vune/MkNotePreview.vune';
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import type { PollEditorModelValue } from '@/components/MkPollEditor.types.js';

const showContent = ref(false);

const props = defineProps<{
	text: string;
	files: Misskey.entities.DriveFile[];
	poll?: PollEditorModelValue;
	useCw: boolean;
	cw: string | null;
	user: Misskey.entities.User;
}>();
</script>

<style lang="scss" module>
.root {
	display: flex;
	margin: 0;
	padding: 0;
	overflow: clip;
	font-size: 0.95em;
}

.avatar {
	flex-shrink: 0 !important;
	display: block !important;
	margin: 0 10px 0 10px !important;
	width: 40px !important;
	height: 40px !important;
	border-radius: 8px !important;
	pointer-events: none !important;
}

.main {
	flex: 1;
	min-width: 0;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.header {
	margin-bottom: 2px;
	font-weight: bold;
	width: 100%;
	overflow: clip;
    text-overflow: ellipsis;
}

@container (min-width: 350px) {
	.avatar {
		margin: 0 10px 0 10px !important;
		width: 44px !important;
		height: 44px !important;
	}
}

@container (min-width: 500px) {
	.avatar {
		margin: 0 12px 0 12px !important;
		width: 48px !important;
		height: 48px !important;
	}
}
</style>
