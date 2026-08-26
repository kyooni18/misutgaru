<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneExploreRoles :roles="roles" :loading="loading"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneExploreRoles from './vune/explore-roles.view.vune';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const roles = ref<Misskey.entities.Role[] | null>(null);
const loading = ref(true);

misskeyApi('roles/list').then(res => {
	roles.value = res.filter(x => x.target === 'manual').sort((a, b) => b.displayOrder - a.displayOrder);
}).finally(() => {
	loading.value = false;
});
</script>

