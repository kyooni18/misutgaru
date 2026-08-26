<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserFiles :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import VuneUserFiles from './vune/files.vune';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.UserDetailed;
}>();

const paginator = markRaw(new Paginator('users/notes', {
	limit: 15,
	computedParams: computed(() => ({
		userId: props.user.id,
		withFiles: true,
	})),
}));
</script>
