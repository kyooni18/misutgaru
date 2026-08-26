<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeThemePreview :themeVariables="themeVariables"/>
</template>

<script setup lang="ts">
import VuneThemePreview from './vune/MkThemePreview.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { ref, watch } from 'vue';
import lightTheme from '@@/themes/_light.json5';
import darkTheme from '@@/themes/_dark.json5';
import type { Theme } from '@@/js/theme.js';
import { compile } from '@@/js/theme.js';
import { deepClone } from '@/utility/clone.js';

const NativeThemePreview = createVuneWebHost(VuneThemePreview);

const props = defineProps<{
	theme: Theme;
}>();

const themeVariables = ref<{
	bg: string;
	panel: string;
	fg: string;
	mention: string;
	hashtag: string;
	link: string;
	divider: string;
	accent: string;
	accentedBg: string;
	navBg: string;
	pageHeaderBg: string;
	success: string;
	warn: string;
	error: string;
}>({
	bg: 'var(--MI_THEME-bg)',
	panel: 'var(--MI_THEME-panel)',
	fg: 'var(--MI_THEME-fg)',
	mention: 'var(--MI_THEME-mention)',
	hashtag: 'var(--MI_THEME-hashtag)',
	link: 'var(--MI_THEME-link)',
	divider: 'var(--MI_THEME-divider)',
	accent: 'var(--MI_THEME-accent)',
	accentedBg: 'var(--MI_THEME-accentedBg)',
	navBg: 'var(--MI_THEME-navBg)',
	pageHeaderBg: 'var(--MI_THEME-pageHeaderBg)',
	success: 'var(--MI_THEME-success)',
	warn: 'var(--MI_THEME-warn)',
	error: 'var(--MI_THEME-error)',
});

watch(() => props.theme, (theme) => {
	if (theme == null) return;

	const _theme = deepClone(theme);

	if (_theme.base != null) {
		const base = [lightTheme, darkTheme].find(x => x.id === _theme.base);
		if (base) _theme.props = Object.assign({}, base.props, _theme.props);
	}

	const compiled = compile(_theme);

	themeVariables.value = {
		bg: compiled.bg ?? 'var(--MI_THEME-bg)',
		panel: compiled.panel ?? 'var(--MI_THEME-panel)',
		fg: compiled.fg ?? 'var(--MI_THEME-fg)',
		mention: compiled.mention ?? 'var(--MI_THEME-mention)',
		hashtag: compiled.hashtag ?? 'var(--MI_THEME-hashtag)',
		link: compiled.link ?? 'var(--MI_THEME-link)',
		divider: compiled.divider ?? 'var(--MI_THEME-divider)',
		accent: compiled.accent ?? 'var(--MI_THEME-accent)',
		accentedBg: compiled.accentedBg ?? 'var(--MI_THEME-accentedBg)',
		navBg: compiled.navBg ?? 'var(--MI_THEME-navBg)',
		pageHeaderBg: compiled.pageHeaderBg ?? 'var(--MI_THEME-pageHeaderBg)',
		success: compiled.success ?? 'var(--MI_THEME-success)',
		warn: compiled.warn ?? 'var(--MI_THEME-warn)',
		error: compiled.error ?? 'var(--MI_THEME-error)',
	};
}, { immediate: true });
</script>
