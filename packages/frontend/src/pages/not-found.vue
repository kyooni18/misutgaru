<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNotFound/>
</template>

<script lang="ts" setup>
import NotFoundPage from './vune/not-found.vune';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneNotFound = createVuneWebHost(NotFoundPage);

const props = defineProps<{
	showLoginPopup?: boolean;
}>();

if (props.showLoginPopup) {
	pleaseLogin({ path: '/' });
}

definePage(() => ({
	title: i18n.ts.notFound,
	icon: 'ti ti-alert-triangle',
}));
</script>
