<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFlashsViewHost :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import * as Misskey from 'misskey-js';
import VuneFlashsView from './vune/flashs.view.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const VuneFlashsViewHost = createVuneWebHost(VuneFlashsView, { deepProps: ['paginator'] });
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.User;
}>();

const paginator = markRaw(new Paginator('users/flashs', {
	limit: 20,
	computedParams: computed(() => ({
		userId: props.user.id,
	})),
}));
</script>
