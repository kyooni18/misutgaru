<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePluginInstall
	:code="code"
	:onCodeChange="value => code = value"
	:onInstall="install"
/>
</template>

<script lang="ts" setup>
import { nextTick, ref, computed } from 'vue';
import VunePluginInstall from './vune/plugin.install.vune';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { installPlugin } from '@/plugin.js';
import { useRouter } from '@/router.js';

const router = useRouter();
const code = ref<string | null>(null);

async function install() {
	if (!code.value) return;

	try {
		await installPlugin(code.value);
		os.success();
		code.value = null;

		router.push('/settings/plugin');
	} catch (err: any) {
		os.alert({
			type: 'error',
			title: 'Install failed',
			text: err.toString() ?? null,
		});
	}
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._plugin.install,
	icon: 'ti ti-download',
}));
</script>
