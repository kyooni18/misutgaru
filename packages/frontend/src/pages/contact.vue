<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneContact :userEnv="userEnv" :onOpened="onOpened"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneContact from './vune/contact.view.vune.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { getUserEnvironment } from '@/utility/get-user-environment.js';
import type { UserEnvironment } from '@/utility/get-user-environment.js';

const userEnv = ref<UserEnvironment | null>(null);
async function onOpened() {
	if (userEnv.value == null) userEnv.value = await getUserEnvironment();
}
definePage(() => ({ title: i18n.ts.inquiry, icon: 'ti ti-help-circle' }));
</script>
