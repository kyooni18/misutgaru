<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAccountMoved :user="user" :rootClass="$style.root" :linkClass="$style.link"/>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import AccountMoved from './vune/MkAccountMoved.vune';
import { fetchMovedUser } from './MkAccountMoved.data.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneAccountMoved = createVuneWebHost(AccountMoved);

const user = ref<Misskey.entities.UserLite>();

const props = defineProps<{
	movedTo: string; // user id
}>();

let requestGeneration = 0;
watch(() => props.movedTo, userId => {
	const generation = ++requestGeneration;
	user.value = undefined;
	void fetchMovedUser(userId).then(result => {
		if (generation === requestGeneration) user.value = result;
	}).catch(() => {});
}, { immediate: true });

onBeforeUnmount(() => {
	requestGeneration++;
});
</script>

<style lang="scss" module>
.root {
	padding: 16px;
	font-size: 90%;
	background: var(--MI_THEME-infoWarnBg);
	color: var(--MI_THEME-error);
	border-radius: var(--MI-radius);
}

.link {
	margin-left: 4px;
}
</style>
