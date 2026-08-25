<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserLists :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import VuneUserLists from './vune/lists.vune.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.UserDetailed;
}>();

const paginator = markRaw(new Paginator('users/lists/list', {
	noPaging: true,
	limit: 10,
	params: {
		userId: props.user.id,
	},
}));
</script>
