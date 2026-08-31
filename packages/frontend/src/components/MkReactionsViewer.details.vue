<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneReactionDetailsHost
	:showing="showing"
	:reaction="reaction"
	:users="users"
	:count="count"
	:anchorElement="anchorElement"
	:classes="$style"
	:onClosed="() => emit('closed')"
/>
</template>

<script lang="ts" setup>
import VuneReactionDetails from './vune/MkReactionsViewer.details.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneReactionDetailsHost = createVuneWebHost(VuneReactionDetails);
import * as Misskey from 'misskey-js';

defineProps<{
	showing: boolean;
	reaction: string;
	users: Misskey.entities.UserLite[];
	count: number;
	anchorElement: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

</script>

<style lang="scss" module>
.root {
	display: flex;
}

.reaction {
	max-width: 100px;
	padding-right: 10px;
	text-align: center;
	border-right: solid 0.5px var(--MI_THEME-divider);
}

.reactionIcon {
	display: block;
	width: 60px;
	max-height: 60px;
	font-size: 60px; // unicodeな絵文字についてはwidthが効かないため
	object-fit: contain;
	margin: 0 auto;
}

.reactionName {
	font-size: 1em;
}

.users {
	flex: 1;
	min-width: 0;
	margin: -4px 14px 0 10px;
	font-size: 0.95em;
	text-align: left;
}

.user {
	display: flex;
	line-height: 24px;
	padding-top: 4px;
	white-space: nowrap;
	overflow: visible;
	text-overflow: ellipsis;
}

.avatar {
	width: 24px;
	height: 24px;
	margin-right: 3px;
}

.more {
	padding-top: 4px;
}
</style>
