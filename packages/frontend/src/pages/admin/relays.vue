<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneRelays :relays="relays" :headerActions="headerActions" :headerTabs="headerTabs" :iconClass="$style.icon" :onRemove="remove"/>
</template>

<script lang="ts" setup>
import VuneRelays from './vune/relays.vune?vue-host';
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const relays = ref<Misskey.entities.AdminRelaysListResponse>([]);

async function addRelay() {
	const { canceled, result: inbox } = await os.inputText({
		title: i18n.ts.addRelay,
		type: 'url',
		placeholder: i18n.ts.inboxUrl,
	});
	if (canceled || inbox == null) return;
	misskeyApi('admin/relays/add', {
		inbox,
	}).then(() => {
		refresh();
	}).catch((err: any) => {
		os.alert({
			type: 'error',
			text: err.message || err,
		});
	});
}

function remove(inbox: string) {
	misskeyApi('admin/relays/remove', {
		inbox,
	}).then(() => {
		refresh();
	}).catch((err: any) => {
		os.alert({
			type: 'error',
			text: err.message || err,
		});
	});
}

function refresh() {
	misskeyApi('admin/relays/list').then(relayList => {
		relays.value = relayList;
	});
}

refresh();

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-plus',
	text: i18n.ts.addRelay,
	handler: addRelay,
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.relays,
	icon: 'ti ti-planet',
}));
</script>

<style lang="scss" module>
.icon {
	width: 1em;
	margin-right: 0.75em;
}
</style>
