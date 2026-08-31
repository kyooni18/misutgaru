<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAdminFiles
	:origin="origin"
	:originDef="originDef"
	:searchHost="searchHost"
	:userId="userId"
	:mimeType="type"
	:viewMode="viewMode"
	:paginator="paginator"
	:hostDisabled="paginator.computedParams?.value?.origin === 'local'"
	:headerActions="headerActions"
	:headerTabs="headerTabs"
	:onOrigin="setOrigin"
	:onHost="(value: string) => searchHost = value"
	:onUserId="(value: string) => userId = value"
	:onMimeType="(value: string | null) => type = value"
/>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import VuneAdminFiles from './vune/files.vune?vue-host';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { lookupFile } from '@/utility/admin-lookup.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { Paginator } from '@/utility/paginator.js';

const {
	model: origin,
	def: originDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'local',
});
const type = ref<string | null>(null);
const searchHost = ref('');
const userId = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

function setOrigin(value: 'local' | 'remote' | 'combined'): void {
	origin.value = value;
}

const paginator = markRaw(new Paginator('admin/drive/files', {
	limit: 10,
	computedParams: computed(() => ({
		type: (type.value && type.value !== '') ? type.value : null,
		userId: (userId.value && userId.value !== '') ? userId.value : null,
		origin: origin.value,
		hostname: (searchHost.value && searchHost.value !== '') ? searchHost.value : null,
	})),
}));

function clear() {
	os.confirm({
		type: 'warning',
		text: i18n.ts.clearCachedFilesConfirm,
	}).then(({ canceled }) => {
		if (canceled) return;

		os.apiWithDialog('admin/drive/clean-remote-files', {});
	});
}

const headerActions = computed(() => [{
	text: i18n.ts.lookup,
	icon: 'ti ti-search',
	handler: lookupFile,
}, {
	text: i18n.ts.clearCachedFiles,
	icon: 'ti ti-trash',
	handler: clear,
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.files,
	icon: 'ti ti-cloud',
}));
</script>
