<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneSignupComplete :submitting="submitting" :onSubmit="submit"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { i18n } from '@/i18n.js';
import VuneSignupComplete from './vune/signup-complete.vune?vue-host';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { login } from '@/accounts.js';

const submitting = ref(false);

const props = defineProps<{
	code: string;
}>();

function submit() {
	if (submitting.value) return;
	submitting.value = true;

	misskeyApi('signup-pending', {
		code: props.code,
	}).then(res => {
		return login(res.i, '/');
	}).catch(() => {
		submitting.value = false;

		os.alert({
			type: 'error',
			title: i18n.ts.somethingHappened,
			text: i18n.ts.emailVerificationFailedError,
		});
	});
}
</script>
