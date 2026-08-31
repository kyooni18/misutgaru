<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSearch :tab="tab" :searchProps="props" :notesAvailable="notesSearchAvailable" :usersAvailable="usersSearchAvailable" :ignoreNotesAvailable="props.ignoreNotesSearchAvailable" :headerActions="headerActions" :headerTabs="headerTabs" :onTabChange="(value: 'note' | 'user') => tab = value"/>
</template>

<script lang="ts" setup>
import VuneSearch from '@/pages/vune/search.vune?vue-host';
import { computed, ref, toRef } from 'vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { notesSearchAvailable, usersSearchAvailable } from '@/utility/check-permissions.js';

const props = withDefaults(defineProps<{
	query?: string,
	userId?: string,
	username?: string,
	host?: string | null,
	type?: 'note' | 'user',
	origin?: 'combined' | 'local' | 'remote',
	// For storybook only
	ignoreNotesSearchAvailable?: boolean,
}>(), {
	query: '',
	userId: undefined,
	username: undefined,
	host: undefined,
	type: 'note',
	origin: 'combined',
	ignoreNotesSearchAvailable: false,
});
const tab = ref(toRef(props, 'type').value);

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'note',
	title: i18n.ts.notes,
	icon: 'ti ti-pencil',
}, {
	key: 'user',
	title: i18n.ts.users,
	icon: 'ti ti-users',
}]);

definePage(() => ({
	title: i18n.ts.search,
	icon: 'ti ti-search',
}));
</script>
