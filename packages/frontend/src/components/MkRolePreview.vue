<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeRolePreview :role="role" :forModeration="forModeration" :detailed="detailed"/>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import VuneRolePreview from './vune/MkRolePreview.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeRolePreview = createVuneWebHost(VuneRolePreview);

withDefaults(defineProps<{
	role: Misskey.entities.Role | Misskey.entities.IResponse['roles'][number];
	forModeration: boolean;
	detailed?: boolean;
}>(), {
	detailed: true,
});
</script>
