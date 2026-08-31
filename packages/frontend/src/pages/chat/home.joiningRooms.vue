<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneJoiningRoomsHost :memberships="memberships" :fetching="fetching"/>
</template>

<script lang="ts" setup>
import VuneJoiningRooms from './vune/home.joiningRooms.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneJoiningRoomsHost = createVuneWebHost(VuneJoiningRooms);
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';

const fetching = ref(true);
const memberships = ref<Misskey.entities.ChatRoomMembership[]>([]);

async function fetchRooms() {
	fetching.value = true;

	const res = await misskeyApi('chat/rooms/joining');

	memberships.value = res;

	fetching.value = false;
}

onMounted(() => {
	fetchRooms();
});
</script>

<style lang="scss" module>

</style>
