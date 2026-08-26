<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNoteMediaGrid
	:note="note"
	:square="square"
	:classes="$style"
	:isHiding="isHiding"
	:onReveal="reveal"
/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneNoteMediaGrid from './vune/MkNoteMediaGrid.vune';
import * as Misskey from 'misskey-js';
import { shouldHideFileByDefault, canRevealFile } from '@/utility/sensitive-file.js';

defineProps<{
	note: Misskey.entities.Note;
	square?: boolean;
}>();

const showingFiles = ref<Set<string>>(new Set());

function isHiding(file: Misskey.entities.DriveFile) {
	if (shouldHideFileByDefault(file) && !showingFiles.value.has(file.id)) {
		if (!file.isSensitive && !file.type.startsWith('image/')) {
			return false;
		}
		return true;
	}
	return false;
}

async function reveal(file: Misskey.entities.DriveFile) {
	if (!(await canRevealFile(file))) {
		return;
	}

	showingFiles.value.add(file.id);
}
</script>

<style lang="scss" module>
.square {
	width: 100%;
	height: auto;
	aspect-ratio: 1;
}

.filePreview {
	position: relative;
	height: 128px;
	border-radius: calc(var(--MI-radius) / 2);
	overflow: clip;

	&:hover {
		text-decoration: none;
	}

	&.square {
		height: 100%;
	}
}

.file {
	width: 100%;
	height: 100%;
	border-radius: calc(var(--MI-radius) / 2);
}

.sensitive {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: grid;
  place-items: center;
	font-size: 0.8em;
	text-align: center;
	padding: 8px;
	border-radius: calc(var(--MI-radius) / 2);
	box-sizing: border-box;
	color: #fff;
	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(5px);
	cursor: pointer;
}
</style>
