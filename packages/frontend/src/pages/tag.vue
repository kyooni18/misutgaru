<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneTag :paginator="paginator" :headerActions="headerActions" :headerTabs="headerTabs" :signedIn="$i != null" :onPost="post"/>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import type { PageHeaderItem } from '@/types/page-header.js';
import VuneTag from './vune/tag.vune?vue-host';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { genEmbedCode } from '@/utility/get-embed-code.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{ tag: string }>();
const paginator = markRaw(new Paginator('notes/search-by-tag', {
	limit: 10,
	computedParams: computed(() => ({ tag: props.tag })),
}));

async function post() {
	store.set('postFormHashtags', props.tag);
	store.set('postFormWithHashtags', true);
	await os.post();
	store.set('postFormHashtags', '');
	store.set('postFormWithHashtags', false);
	paginator.reload();
}

const headerActions = computed<PageHeaderItem[]>(() => [{
	icon: 'ti ti-dots',
	text: i18n.ts.more,
	handler: (ev) => {
		os.popupMenu([{
			text: i18n.ts.embed,
			icon: 'ti ti-code',
			action: () => genEmbedCode('tags', props.tag),
		}], ev.currentTarget ?? ev.target);
	},
}]);
const headerTabs = computed(() => []);
definePage(() => ({ title: props.tag, icon: 'ti ti-hash' }));
</script>
