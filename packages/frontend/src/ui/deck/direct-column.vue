<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneDirectColumn :column="column" :isStacked="isStacked" :paginator="paginator"/>
</template>
<script lang="ts" setup>
import { markRaw } from 'vue';
import VuneDirectColumn from './vune/direct-column.vune?vue-host';
import type { Column } from '@/deck.js';
import { Paginator } from '@/utility/paginator.js';

defineProps<{ column: Column; isStacked: boolean }>();
const paginator = markRaw(new Paginator('notes/mentions', {
	limit: 10,
	params: { visibility: 'specified' },
}));
</script>
