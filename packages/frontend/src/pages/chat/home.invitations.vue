<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneInvitations :fetching="fetching" :invitations="invitations" :bodyClass="$style.invitationBody" :avatarClass="$style.invitationBodyAvatar" :onJoin="join" :onIgnore="ignore"/>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneInvitations from './vune/home.invitations.vune.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';

const router = useRouter();

const fetching = ref(true);
const invitations = ref<Misskey.entities.ChatRoomInvitation[]>([]);

async function fetchInvitations() {
	fetching.value = true;

	const res = await misskeyApi('chat/rooms/invitations/inbox');

	invitations.value = res;

	fetching.value = false;
}

async function join(invitation: Misskey.entities.ChatRoomInvitation) {
	await misskeyApi('chat/rooms/join', {
		roomId: invitation.room.id,
	});

	router.push('/chat/room/:roomId', {
		params: {
			roomId: invitation.room.id,
		},
	});
}

async function ignore(invitation: Misskey.entities.ChatRoomInvitation) {
	await misskeyApi('chat/rooms/invitations/ignore', {
		roomId: invitation.room.id,
	});

	invitations.value = invitations.value.filter(i => i.id !== invitation.id);
}

onMounted(() => {
	fetchInvitations();
});
</script>

<style lang="scss" module>
.invitationBody {
	display: flex;
	align-items: center;
}

.invitationBodyAvatar {
	margin-right: 12px;
	width: 45px;
	height: 45px;
}
</style>
