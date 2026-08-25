<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFollowList :type="type" :followingPaginator="followingPaginator" :followersPaginator="followersPaginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import VuneFollowList from './vune/follow-list.vune.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.User;
	type: 'following' | 'followers';
}>();

const followingPaginator = markRaw(new Paginator('users/following', {
	limit: 20,
	computedParams: computed(() => ({
		userId: props.user.id,
	})),
}));

const followersPaginator = markRaw(new Paginator('users/followers', {
	limit: 20,
	computedParams: computed(() => ({
		userId: props.user.id,
	})),
}));
</script>
