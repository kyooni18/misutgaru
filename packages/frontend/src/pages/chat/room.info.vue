<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneRoomInfo
	:props="{
		name: name_,
		description: description_,
		isOwner,
		canDelete: isOwner || $i.isAdmin || $i.isModerator,
		isMuted,
		onName: updateName,
		onDescription: updateDescription,
		onMuted: updateMuted,
		onSave: save,
		onDelete: del,
	}"
/>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import VuneRoomInfoView from './vune/room.info.vune';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { ensureSignin } from '@/i.js';
import { useRouter } from '@/router.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneRoomInfo = createVuneWebHost(VuneRoomInfoView);

const router = useRouter();
const $i = ensureSignin();

const props = defineProps<{
	room: Misskey.entities.ChatRoom;
}>();

const isOwner = computed(() => {
	return props.room.ownerId === $i.id;
});

const name_ = ref(props.room.name);
const description_ = ref(props.room.description);

function updateName(value: string): void {
	name_.value = value;
}

function updateDescription(value: string): void {
	description_.value = value;
}

function save() {
	os.apiWithDialog('chat/rooms/update', {
		roomId: props.room.id,
		name: name_.value,
		description: description_.value,
	});
}

async function del() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: name_.value }),
	});
	if (canceled) return;

	await os.apiWithDialog('chat/rooms/delete', {
		roomId: props.room.id,
	});
	router.push('/chat');
}

const isMuted = ref(props.room.isMuted ?? false);

function updateMuted(value: boolean): void {
	isMuted.value = value;
}

watch(isMuted, async () => {
	await os.apiWithDialog('chat/rooms/mute', {
		roomId: props.room.id,
		mute: isMuted.value,
	});
});
</script>

<style lang="scss" module>
.membership {
	display: flex;
}

.membershipBody {
	flex: 1;
	min-width: 0;
	margin-right: 8px;

	&:hover {
		text-decoration: none;
	}
}
</style>
