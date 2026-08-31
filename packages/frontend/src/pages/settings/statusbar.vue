<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneStatusbar :statusbars="statusbars" :userLists="userLists" :onAdd="add"/>
</template>

<script lang="ts" setup>
import { onMounted, ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import VuneStatusbar from './vune/statusbar.vune?vue-host';
import { genId } from '@/utility/id.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences.js';

const statusbars = prefer.r.statusbars;

const userLists = ref<Misskey.entities.UserList[] | null>(null);

onMounted(() => {
	misskeyApi('users/lists/list').then(res => {
		userLists.value = res;
	});
});

async function add() {
	prefer.commit('statusbars', [...statusbars.value, {
		id: genId(),
		name: null,
		type: null,
		black: false,
		size: 'medium',
		props: {},
	}]);
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.statusbar,
	icon: 'ti ti-list',
}));
</script>
