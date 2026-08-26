<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneZen :showDeckNav="showDeckNav" :onGoToDeck="goToDeck">
	<template #router><RouterView/></template>
	<template #common><XCommon/></template>
</VuneZen>
</template>

<script lang="ts" setup>
import { computed, provide, ref } from 'vue';
import { instanceName, ui } from '@@/js/config.js';
import XCommon from './_common_/common.vue';
import type { PageMetadata } from '@/page.js';
import { provideMetadataReceiver, provideReactiveMetadata } from '@/page.js';
import { mainRouter } from '@/router.js';
import { DI } from '@/di.js';
import VuneZen from './vune/zen.vune';

const isRoot = computed(() => mainRouter.currentRoute.value.name === 'index');

const pageMetadata = ref<null | PageMetadata>(null);

const showDeckNav = !(new URLSearchParams(window.location.search)).has('zen') && ui === 'deck';

provide(DI.router, mainRouter);
provideMetadataReceiver((metadataGetter) => {
	const info = metadataGetter();
	pageMetadata.value = info;
	if (pageMetadata.value) {
		if (isRoot.value && pageMetadata.value.title === instanceName) {
			window.document.title = pageMetadata.value.title;
		} else {
			window.document.title = `${pageMetadata.value.title} | ${instanceName}`;
		}
	}
});
provideReactiveMetadata(pageMetadata);

function goToDeck() {
	window.location.href = '/';
}
</script>
