<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneMyClipsIndex :tab="tab" :paginator="paginator" :favoritesPaginator="favoritesPaginator" :headerActions="headerActions" :headerTabs="headerTabs" :onCreate="create" :onTabChange="value => tab = value"/>
</template>

<script lang="ts" setup>
import VuneMyClipsIndex from '@/pages/vune/my-clips-index.vune';
import { ref, computed, markRaw } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { clipsCache } from '@/cache.js';
import { Paginator } from '@/utility/paginator.js';

const tab = ref('my');

const paginator = markRaw(new Paginator('clips/list', {
}));

const favoritesPaginator = markRaw(new Paginator('clips/my-favorites', {
	// ページネーションに対応していない
	noPaging: true,
}));

async function create() {
	const { canceled, result } = await os.form(i18n.ts.createNewClip, {
		name: {
			type: 'string',
			label: i18n.ts.name,
		},
		description: {
			type: 'string',
			required: false,
			multiline: true,
			treatAsMfm: true,
			label: i18n.ts.description,
		},
		isPublic: {
			type: 'boolean',
			label: i18n.ts.public,
			default: false,
		},
	});

	if (canceled) return;

	os.apiWithDialog('clips/create', result);

	clipsCache.delete();

	paginator.reload();
}

function onClipCreated() {
	paginator.reload();
}

function onClipDeleted() {
	paginator.reload();
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'my',
	title: i18n.ts.myClips,
	icon: 'ti ti-paperclip',
}, {
	key: 'favorites',
	title: i18n.ts.favorites,
	icon: 'ti ti-heart',
}]);

definePage(() => ({
	title: i18n.ts.clip,
	icon: 'ti ti-paperclip',
}));
</script>

<style lang="scss" module>

</style>
