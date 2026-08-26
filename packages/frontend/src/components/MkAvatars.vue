<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneAvatars :users="users" :limit="limit"/>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneAvatars from './vune/MkAvatars.vune';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = withDefaults(defineProps<{
	userIds: string[];
	limit?: number;
}>(), {
	limit: Infinity,
});

const users = ref<Misskey.entities.UserLite[]>([]);

onMounted(async () => {
	users.value = await misskeyApi('users/show', {
		userIds: props.userIds,
	});
});
</script>
