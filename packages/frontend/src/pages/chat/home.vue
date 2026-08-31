<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneChatHome :tab="tab" :headerActions="headerActions" :headerTabs="headerTabs" :onTabChange="(value: string) => tab = value"/>
</template>

<script lang="ts" setup>
import VuneChatHome from './vune/home.vune?vue-host';
import { computed, ref } from 'vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const tab = ref('home');

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'home',
	title: i18n.ts._chat.home,
	icon: 'ti ti-home',
}, {
	key: 'invitations',
	title: i18n.ts._chat.invitations,
	icon: 'ti ti-ticket',
}, {
	key: 'joiningRooms',
	title: i18n.ts._chat.joiningRooms,
	icon: 'ti ti-users-group',
}, {
	key: 'ownedRooms',
	title: i18n.ts._chat.yourRooms,
	icon: 'ti ti-settings',
}]);

definePage(() => ({
	title: i18n.ts.directMessage,
	icon: 'ti ti-messages',
}));
</script>

<style lang="scss" module>
</style>
