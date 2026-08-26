<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneFollowSetup :pinnedUsersPaginator="pinnedUsersPaginator" :popularUsersPaginator="popularUsersPaginator"/>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import VuneFollowSetup from './vune/MkUserSetupDialog.Follow.vune';
import { Paginator } from '@/utility/paginator.js';

const pinnedUsersPaginator = markRaw(new Paginator('pinned-users', {
	noPaging: true,
	limit: 10,
}));

const popularUsersPaginator = markRaw(new Paginator('users', {
	limit: 10,
	noPaging: true,
	params: {
		state: 'alive',
		origin: 'local',
		sort: '+follower',
	},
}));
</script>
