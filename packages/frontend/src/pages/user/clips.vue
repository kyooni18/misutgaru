<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneClipsViewHost :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import VuneClipsView from './vune/clips.view.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneClipsViewHost = createVuneWebHost(VuneClipsView, { deepProps: ['paginator'] });
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.User;
}>();

const paginator = markRaw(new Paginator('users/clips', {
	limit: 20,
	computedParams: computed(() => ({
		userId: props.user.id,
	})),
}));
</script>
