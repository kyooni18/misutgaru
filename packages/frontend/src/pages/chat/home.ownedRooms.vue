<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneOwnedRoomsHost :fetching="fetching" :rooms="rooms"/>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneOwnedRooms from './vune/home.ownedRooms.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneOwnedRoomsHost = createVuneWebHost(VuneOwnedRooms);
import { misskeyApi } from '@/utility/misskey-api.js';

const fetching = ref(true);
const rooms = ref<Misskey.entities.ChatRoom[]>([]);

async function fetchRooms() {
	fetching.value = true;

	const res = await misskeyApi('chat/rooms/owned', {
	});

	rooms.value = res;

	fetching.value = false;
}

onMounted(() => {
	fetchRooms();
});
</script>

<style lang="scss" module>

</style>
