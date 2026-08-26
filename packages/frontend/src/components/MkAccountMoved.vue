<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAccountMoved :user="user" :rootClass="$style.root" :linkClass="$style.link"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneAccountMoved from './vune/MkAccountMoved.vune';
import { misskeyApi } from '@/utility/misskey-api.js';

const user = ref<Misskey.entities.UserLite>();

const props = defineProps<{
	movedTo: string; // user id
}>();

misskeyApi('users/show', { userId: props.movedTo }).then(u => user.value = u);
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
