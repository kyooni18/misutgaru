<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSigninTotp :props="{
	token,
	backup: isBackupCode,
	classes: $style,
	onTokenChange: updateToken,
	onToggleBackup: () => isBackupCode = !isBackupCode,
	onSubmit: () => emit('totpSubmitted', token),
}"/>
</template>

<script setup lang="ts">
import VuneSigninTotpView from './vune/MkSigninTotp.vune';
import { ref } from 'vue';

import { i18n } from '@/i18n.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneSigninTotp = createVuneWebHost(VuneSigninTotpView);

const emit = defineEmits<{
	(ev: 'totpSubmitted', token: string): void;
}>();

const token = ref('');
const isBackupCode = ref(false);

function updateToken(value: string): void {
	token.value = value;
}
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
