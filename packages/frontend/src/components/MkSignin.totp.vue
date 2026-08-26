<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSigninTotp :token="token" :backup="isBackupCode" :classes="$style" :onTokenChange="value => token = value" :onToggleBackup="() => isBackupCode = !isBackupCode" :onSubmit="() => emit('totpSubmitted', token)"/>
</template>

<script setup lang="ts">
import VuneSigninTotp from './vune/MkSigninTotp.vune';
import { ref } from 'vue';

import { i18n } from '@/i18n.js';

const emit = defineEmits<{
	(ev: 'totpSubmitted', token: string): void;
}>();

const token = ref('');
const isBackupCode = ref(false);
</script>

<style lang="scss" module>
.wrapper {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 336px;

	> .root {
		width: 100%;
	}
}

.totpIcon {
	margin: 0 auto;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
	text-align: center;
	height: 64px;
	width: 64px;
	font-size: 24px;
	line-height: 64px;
	border-radius: 50%;
}

.totpDescription {
	text-align: center;
	font-size: 1.1em;
}
</style>
