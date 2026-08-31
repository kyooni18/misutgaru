<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNoteMediaGridHost
	:key="mediaVisibilityKey"
	:note="note"
	:square="square"
	:classes="$style"
	:isHiding="isHiding"
	:onReveal="reveal"
/>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import VuneNoteMediaGrid from './vune/MkNoteMediaGrid.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import * as Misskey from 'misskey-js';
import { prefer } from '@/preferences.js';
import { shouldHideFileByDefault, canRevealFile } from '@/utility/sensitive-file.js';

const VuneNoteMediaGridHost = createVuneWebHost(VuneNoteMediaGrid);

const props = defineProps<{
	note: Misskey.entities.Note;
	square?: boolean;
}>();

const showingFiles = ref<Set<string>>(new Set());

// The Vune renderer receives a stable `isHiding` callback, so changing a
// preference alone would not cause the grid to render again. Bump the key to
// remount it with the new visibility policy and clear any stale reveals.
const mediaVisibilityKey = computed(() => `${prefer.r.nsfw.value}:${prefer.r.dataSaver.value.media}:${prefer.r.showCwMedia.value}`);

const showCwMedia = computed(() => prefer.r.showCwMedia.value);

watch(mediaVisibilityKey, () => {
	showingFiles.value = new Set();
});

function isHiding(file: Misskey.entities.DriveFile) {
	if (showCwMedia.value && props.note.cw != null) return false;

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
