<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneEmailSettings
	:enableEmail="enableEmail"
	:email="email"
	:smtpSecure="smtpSecure"
	:smtpHost="smtpHost"
	:smtpPort="smtpPort"
	:smtpUser="smtpUser"
	:smtpPass="smtpPass"
	:footerClass="$style.footer"
	:headerTabs="headerTabs"
	:onEnableEmail="value => enableEmail = value"
	:onEmail="value => email = value"
	:onSmtpSecure="value => smtpSecure = value"
	:onSmtpHost="value => smtpHost = value"
	:onSmtpPort="value => smtpPort = value"
	:onSmtpUser="value => smtpUser = value"
	:onSmtpPass="value => smtpPass = value"
	:onSave="save"
	:onTest="testEmail"
/>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import VuneEmailSettings from './vune/email-settings.vune';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance, instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const meta = await misskeyApi('admin/meta');

const enableEmail = ref(meta.enableEmail);
const email = ref(meta.email);
const smtpSecure = ref(meta.smtpSecure);
const smtpHost = ref(meta.smtpHost);
const smtpPort = ref(meta.smtpPort);
const smtpUser = ref(meta.smtpUser);
const smtpPass = ref(meta.smtpPass);

async function testEmail() {
	const { canceled, result: destination } = await os.inputText({
		title: 'To',
		type: 'email',
		default: instance.maintainerEmail ?? '',
		placeholder: 'test@example.com',
		minLength: 1,
	});
	if (canceled) return;
	os.apiWithDialog('admin/send-email', {
		to: destination,
		subject: 'Test email',
		text: 'Yo',
	});
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		enableEmail: enableEmail.value,
		email: email.value,
		smtpSecure: smtpSecure.value,
		smtpHost: smtpHost.value,
		smtpPort: smtpPort.value,
		smtpUser: smtpUser.value,
		smtpPass: smtpPass.value,
	}).then(() => {
		fetchInstance(true);
	});
}

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.emailServer,
	icon: 'ti ti-mail',
}));
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}
</style>
