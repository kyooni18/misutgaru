<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VunePieHost :value="value"/>
</template>

<script lang="ts" setup>
import VunePie from './vune/pie.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VunePieHost = createVuneWebHost(VunePie);

defineProps<{
	value: number;
}>();
</script>
