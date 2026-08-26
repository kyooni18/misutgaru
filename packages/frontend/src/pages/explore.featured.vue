<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneExploreFeatured :tab="tab" :notesPaginator="paginatorForNotes" :pollsPaginator="paginatorForPolls" :onTabChange="value => tab = value"/>
</template>

<script lang="ts" setup>
import VuneExploreFeatured from './vune/explore.featured.vune';
import { markRaw, ref } from 'vue';
import { Paginator } from '@/utility/paginator.js';

const paginatorForNotes = markRaw(new Paginator('notes/featured', {
	limit: 10,
}));

const paginatorForPolls = markRaw(new Paginator('notes/polls/recommendation', {
	limit: 10,
	offsetMode: true,
	params: {
		excludeChannels: true,
	},
}));

const tab = ref<'notes' | 'polls'>('notes');
</script>
