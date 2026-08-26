<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneInstanceCardMiniHost :instance="instance" :chartValues="chartValues"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneInstanceCardMini from './vune/MkInstanceCardMini.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';

const VuneInstanceCardMiniHost = createVuneWebHost(VuneInstanceCardMini);

const props = defineProps<{
	instance: Misskey.entities.FederationInstance;
}>();

const chartValues = ref<number[] | null>(null);

misskeyApiGet('charts/instance', { host: props.instance.host, limit: 16 + 1, span: 'day' }).then(res => {
	res.requests.received.splice(0, 1);
	chartValues.value = res.requests.received;
});
</script>
