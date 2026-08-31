<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneRoomSearch
	:searchQuery="searchQuery"
	:searched="searched"
	:searchResults="searchResults"
	:searchResultItemClass="$style.searchResultItem"
	:onQueryChange="(value: string) => searchQuery = value"
	:onSearch="search"
/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneRoomSearch from './vune/room.search.vune?vue-host';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = defineProps<{
	userId?: string;
	roomId?: string;
}>();

const searchQuery = ref('');
const searched = ref(false);
const searchResults = ref<Misskey.entities.ChatMessage[]>([]);

async function search() {
	const res = await misskeyApi('chat/messages/search', {
		query: searchQuery.value,
		roomId: props.roomId,
		userId: props.userId,
	});

	searchResults.value = res;
	searched.value = true;
}
</script>

<style lang="scss" module>
.searchResultItem {
	padding: 12px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 12px;
}
</style>
