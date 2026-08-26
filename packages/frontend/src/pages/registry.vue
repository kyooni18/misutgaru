<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneRegistry :scopes="scopesWithDomain" :headerActions="headerActions" :headerTabs="headerTabs" :onCreateKey="createKey"/>
</template>

<script lang="ts" setup>
import VuneRegistry from '@/pages/vune/registry.vune';
import { ref, computed } from 'vue';
import * as Misskey from 'misskey-js';
import JSON5 from 'json5';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const scopesWithDomain = ref<Misskey.entities.IRegistryScopesWithDomainResponse | null>(null);

function fetchScopes() {
	misskeyApi('i/registry/scopes-with-domain').then(res => {
		scopesWithDomain.value = res;
	});
}

async function createKey() {
	const { canceled, result } = await os.form(i18n.ts._registry.createKey, {
		key: {
			type: 'string',
			label: i18n.ts._registry.key,
		},
		value: {
			type: 'string',
			multiline: true,
			label: i18n.ts.value,
		},
		scope: {
			type: 'string',
			label: i18n.ts._registry.scope,
		},
	});

	if (canceled) return;

	os.apiWithDialog('i/registry/set', {
		scope: result.scope.split('/'),
		key: result.key,
		value: JSON5.parse(result.value),
	}).then(() => {
		fetchScopes();
	});
}

fetchScopes();

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.registry,
	icon: 'ti ti-adjustments',
}));
</script>
