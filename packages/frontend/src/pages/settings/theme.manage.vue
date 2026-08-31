<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneThemeManage
	:props="{
		selectedThemeId,
		selectedThemeIdDef,
		selectedTheme,
		selectedThemeCode,
		isBuiltin: selectedThemeIsBuiltin,
		onThemeId: updateSelectedThemeId,
		onCopy: copyThemeCode,
		onUninstall: uninstall,
	}"
/>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import VuneThemeManageView from './vune/theme.manage.vune';
import JSON5 from 'json5';
import type { Theme } from '@@/js/theme.js';
import { removeTheme } from '@/theme.js';
import { getBuiltinThemes } from '@@/js/theme.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import type { MkSelectItem } from '@/components/MkSelect.vue';
import { prefer } from '@/preferences';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneThemeManage = createVuneWebHost(VuneThemeManageView);

const installedThemes = prefer.r.themes;
const builtinThemes = ref<Theme[]>([]);
getBuiltinThemes().then(themes => {
	builtinThemes.value = themes;
});

const {
	model: selectedThemeId,
	def: selectedThemeIdDef,
} = useMkSelect({
	items: computed<MkSelectItem<string | null>[]>(() => [{
		type: 'group',
		label: i18n.ts._theme.installedThemes,
		items: installedThemes.value.map(x => ({ label: x.name, value: x.id })),
	}, {
		type: 'group',
		label: i18n.ts._theme.builtinThemes,
		items: builtinThemes.value.map(x => ({ label: x.name, value: x.id })),
	}]),
	initialValue: null,
});

const themes = computed(() => [...installedThemes.value, ...builtinThemes.value]);

const selectedTheme = computed(() => {
	if (selectedThemeId.value == null) return null;
	return themes.value.find(x => x.id === selectedThemeId.value);
});

const selectedThemeCode = computed(() => {
	if (selectedTheme.value == null) return null;
	return JSON5.stringify(selectedTheme.value, null, '\t');
});

const selectedThemeIsBuiltin = computed(() => {
	const theme = selectedTheme.value;
	return theme != null && builtinThemes.value.some(t => t.id === theme.id);
});

function updateSelectedThemeId(value: string | null): void {
	selectedThemeId.value = value;
}

function copyThemeCode() {
	copyToClipboard(selectedThemeCode.value);
}

function uninstall() {
	removeTheme(selectedTheme.value as Theme);
	installedThemes.value = installedThemes.value.filter(t => t.id !== selectedThemeId.value);
	selectedThemeId.value = null;
	os.success();
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._theme.manage,
	icon: 'ti ti-tool',
}));
</script>
