<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneInviteCode :invite="invite" :moderator="moderator" :isExpired="!!isExpired" :classes="$style" :onDelete="deleteCode" :onCopy="copyInviteCode"/>
</template>

<script lang="ts" setup>
import VuneInviteCode from './vune/MkInviteCode.vune?vue-host';
import { computed } from 'vue';
import * as Misskey from 'misskey-js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import * as os from '@/os.js';

const props = defineProps<{
	invite: Misskey.entities.InviteCode;
	moderator?: boolean;
}>();

const emits = defineEmits<{
	(event: 'deleted', value: string): void;
}>();

const isExpired = computed(() => {
	return props.invite.expiresAt && new Date(props.invite.expiresAt) < new Date();
});

function deleteCode() {
	os.apiWithDialog('invite/delete', {
		inviteId: props.invite.id,
	});
	emits('deleted', props.invite.id);
}

function copyInviteCode() {
	copyToClipboard(props.invite.code);
}
</script>

<style lang="scss" module>
.root {
	text-align: left;
}

.items {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	grid-gap: 12px;
}

.label {
	font-size: 0.85em;
	padding: 0 0 8px 0;
	user-select: none;
	opacity: 0.7;
}

.user {
	display: flex;
	align-items: center;
	gap: 8px;
}

.avatar {
	--height: 24px;
	width: var(--height);
	height: var(--height);
}
</style>
