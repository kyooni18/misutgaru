<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneExploreRoles :props="{ roles, loading }"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneExploreRolesView from './vune/explore-roles.view.vune';
import { misskeyApi } from '@/utility/misskey-api.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneExploreRoles = createVuneWebHost(VuneExploreRolesView);

const roles = ref<Misskey.entities.Role[] | null>(null);
const loading = ref(true);

misskeyApi('roles/list').then(res => {
	roles.value = res.filter(x => x.target === 'manual').sort((a, b) => b.displayOrder - a.displayOrder);
}).finally(() => {
	loading.value = false;
});
</script>

