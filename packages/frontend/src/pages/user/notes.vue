<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserNotes :tab="tab" :featuredPaginator="featuredPaginator" :notesPaginator="notesPaginator" :tabClass="$style.tab" :timelineClass="$style.tl" :onTabChange="value => tab = value"/>
</template>

<script lang="ts" setup>
import VuneUserNotes from './vune/notes.vune';
import { ref, computed, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.UserDetailed;
}>();

const tab = ref<'featured' | 'notes' | 'all' | 'files'>('all');

const featuredPaginator = markRaw(new Paginator('users/featured-notes', {
	limit: 10,
	params: {
		userId: props.user.id,
	},
}));

const notesPaginator = markRaw(new Paginator('users/notes', {
	limit: 10,
	computedParams: computed(() => ({
		userId: props.user.id,
		withRenotes: tab.value === 'all',
		withReplies: tab.value === 'all',
		withChannelNotes: tab.value === 'all',
		withFiles: tab.value === 'files',
	})),
}));
</script>

<style lang="scss" module>
.tab {
	padding: calc(var(--MI-margin) / 2) 0;
	background: var(--MI_THEME-bg);
}

.tl {
	background: var(--MI_THEME-bg);
	border-radius: var(--MI-radius);
	overflow: clip;
}
</style>
