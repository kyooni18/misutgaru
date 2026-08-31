<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNoteSimple :note="note" :showContent="showContent" :showCwMedia="prefer.r.showCwMedia.value" :useStickyIcons="prefer.s.useStickyIcons" :classes="$style" :onShowContent="(value: boolean) => showContent = value"/>
</template>

<script lang="ts" setup>
import VuneNoteSimple from './vune/MkNoteSimple.vune?vue-host';
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	note: Misskey.entities.Note | null;
}>();

const showContent = ref(false);
</script>

<style lang="scss" module>
.root {
	display: flex;
	margin: 0;
	padding: 0;
	font-size: 0.95em;
}

.avatar {
	flex-shrink: 0;
	display: block;
	margin: 0 10px 0 0;
	width: 34px;
	height: 34px;
	border-radius: 8px;

	&.useSticky {
		position: sticky !important;
		top: calc(16px + var(--MI-stickyTop, 0px));
		left: 0;
	}
}

.main {
	flex: 1;
	min-width: 0;
}

.header {
	margin-bottom: 2px;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.text {
	cursor: default;
	margin: 0;
	padding: 0;
}

@container (min-width: 250px) {
	.avatar {
		margin: 0 10px 0 0;
		width: 40px;
		height: 40px;
	}
}

@container (min-width: 350px) {
	.avatar {
		margin: 0 10px 0 0;
		width: 44px;
		height: 44px;
	}
}

@container (min-width: 500px) {
	.avatar {
		margin: 0 12px 0 0;
		width: 48px;
		height: 48px;
	}
}

.deleted {
	text-align: center;
	padding: 8px !important;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}
</style>
