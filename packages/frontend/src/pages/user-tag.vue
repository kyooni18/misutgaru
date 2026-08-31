<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserTag :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import VuneUserTag from './vune/user-tag.vune?vue-host';
import { definePage } from '@/page.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	tag: string;
}>();

const paginator = markRaw(new Paginator('hashtags/users', {
	limit: 30,
	offsetMode: true,
	computedParams: computed(() => ({
		tag: props.tag,
		origin: 'combined',
		sort: '+follower',
	})),
}));

definePage(() => ({
	title: props.tag,
	icon: 'ti ti-user-search',
}));
</script>

