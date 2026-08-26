<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneExtensionInstaller :extension="extension" :classes="$style" :onConfirm="() => emits('confirm')" :onCancel="() => emits('cancel')">
	<template #additionalInfo><slot name="additionalInfo"></slot></template>
</VuneExtensionInstaller>
</template>

<script lang="ts">
import * as Misskey from 'misskey-js';

export type Extension = {
	type: 'plugin';
	raw: string;
	meta: {
		name: string;
		version: string;
		author: string;
		description?: string;
		permissions?: (typeof Misskey.permissions)[number][];
		config?: Record<string, unknown>;
	};
} | {
	type: 'theme';
	raw: string;
	meta: {
		name: string;
		author: string;
		base?: 'light' | 'dark';
	};
};
</script>
<script lang="ts" setup>
import VuneExtensionInstaller from './vune/MkExtensionInstaller.vune';

defineProps<{
	extension: Extension;
}>();

const emits = defineEmits<{
	(ev: 'confirm'): void;
	(ev: 'cancel'): void;
}>();
</script>

<style lang="scss" module>
.extInstallerRoot {
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
	padding: 20px;
}

.extInstallerIconWrapper {
	width: 48px;
	height: 48px;
	font-size: 20px;
	line-height: 48px;
	text-align: center;
	border-radius: 50%;
	margin-left: auto;
	margin-right: auto;

	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}

.extInstallerTitle {
	font-size: 1.2rem;
	text-align: center;
	margin: 0;
}

.extInstallerKVList {
	margin-top: 0;
	margin-bottom: 0;
}
</style>
