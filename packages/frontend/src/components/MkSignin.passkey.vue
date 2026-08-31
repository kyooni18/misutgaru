<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSigninPasskey :queryingKey="queryingKey" :passwordless="props.isPerformingPasswordlessLogin" :classes="$style" :onRetry="queryKey" :onUseTotp="() => emit('useTotp')"/>
</template>

<script setup lang="ts">
import VuneSigninPasskeyView from './vune/MkSigninPasskey.vune';
import { ref, onMounted } from 'vue';
import { startAuthentication } from '@simplewebauthn/browser';

import { i18n } from '@/i18n.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

import type { PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

const VuneSigninPasskey = createVuneWebHost(VuneSigninPasskeyView);

const props = defineProps<{
	credentialRequest: PublicKeyCredentialRequestOptionsJSON;
	isPerformingPasswordlessLogin?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'done', credential: AuthenticationResponseJSON): void;
	(ev: 'useTotp'): void;
}>();

const queryingKey = ref(true);

async function queryKey() {
	queryingKey.value = true;
	await startAuthentication({ optionsJSON: props.credentialRequest })
		.catch(() => {
			return Promise.reject(null);
		})
		.then((credential) => {
			emit('done', credential);
		})
		.finally(() => {
			queryingKey.value = false;
		});
}

onMounted(() => {
	queryKey();
});
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

.passkeyIcon {
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

.passkeyDescription {
	text-align: center;
	font-size: 1.1em;
}
</style>
