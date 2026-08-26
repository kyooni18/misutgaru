<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneThemeInstall :code="installThemeCode" :onCodeChange="value => installThemeCode = value" :onPreview="previewTheme" :onInstall="install"/>
</template>

<script lang="ts" setup>
import VuneThemeInstall from './vune/theme-install.vune';
import { ref, computed } from 'vue';
import { themeManager, installTheme, handleThemeInstallError } from '@/theme.js';
import { parseThemeCode } from '@@/js/theme.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';

const router = useRouter();
const installThemeCode = ref<string | null>(null);

function previewTheme(code: string): void {
	try {
		const theme = parseThemeCode(code);
		themeManager.previewTheme(theme);
	} catch (err) {
		os.alert({
			type: 'error',
			text: i18n.ts._theme.invalid,
		});
		console.error(err);
	}
}

async function install(code: string): Promise<void> {
	try {
		const theme = parseThemeCode(code);
		await installTheme(code);
		os.alert({
			type: 'success',
			text: i18n.tsx._theme.installed({ name: theme.name }),
		});
		installThemeCode.value = null;
		router.push('/settings/theme');
	} catch (err: any) {
		handleThemeInstallError(err);
	}
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._theme.install,
	icon: 'ti ti-download',
}));
</script>
