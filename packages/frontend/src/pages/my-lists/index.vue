<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneMyListsIndex :items="items" :userListLimit="$i.policies['userEachUserListsLimit']" :headerActions="headerActions" :headerTabs="headerTabs" :listClass="$style.list" :nUsersClass="$style.nUsers" :onCreate="create"/>
</template>

<script lang="ts" setup>
import VuneMyListsIndex from '@/pages/vune/my-lists-index.vune?vue-host';
import { onActivated, computed } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { userListsCache } from '@/cache.js';
import { ensureSignin } from '@/i.js';

const $i = ensureSignin();

const items = computed(() => userListsCache.value.value ?? []);

function _fetch_() {
	userListsCache.fetch();
}

_fetch_();

async function create() {
	const { canceled, result: name } = await os.inputText({
		title: i18n.ts.enterListName,
	});
	if (canceled || name == null) return;
	await os.apiWithDialog('users/lists/create', { name: name });
	userListsCache.delete();
	_fetch_();
}

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: () => {
		userListsCache.delete();
		_fetch_();
	},
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.manageLists,
	icon: 'ti ti-list',
}));

onActivated(() => {
	_fetch_();
});
</script>

<style lang="scss" module>
.list {
	display: block;
	padding: 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 6px;
	margin-bottom: 8px;

	&:hover {
		border: solid 1px var(--MI_THEME-accent);
		text-decoration: none;
	}
}

.nUsers {
	font-size: .9em;
	opacity: .7;
}
</style>
