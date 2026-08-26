<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAuthForm :permissions="permissions" :name="name" :appId="app.id" :buttonsClass="$style.buttons" :onCancel="cancel" :onAccept="accept"/>
</template>

<script lang="ts" setup>
import VuneAuthForm from './vune/auth-form.vune';
import { computed } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	session: Misskey.entities.AuthSessionShowResponse;
}>();

const emit = defineEmits<{
	(event: 'accepted'): void;
	(event: 'denied'): void;
}>();

const app = computed(() => props.session.app);

const permissions = computed(() => {
	return props.session.app.permission.filter((p): p is typeof Misskey.permissions[number] => typeof p === 'string');
});

const name = computed(() => {
	const el = window.document.createElement('div');
	el.textContent = app.value.name;
	return el.innerHTML;
});

function cancel() {
	//misskeyApi('auth/deny', {
	//	token: props.session.token,
	//}).then(() => {
	//	emit('denied');
	//});

	emit('denied');
}

function accept() {
	misskeyApi('auth/accept', {
		token: props.session.token,
	}).then(() => {
		emit('accepted');
	});
}
</script>

<style lang="scss" module>
.buttons {
	margin-top: 16px;
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}
</style>
