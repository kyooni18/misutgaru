<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneMentionsColumn :column="column" :isStacked="isStacked" :paginator="paginator"/>
</template>
<script lang="ts" setup>
import { markRaw } from 'vue';
import VuneMentionsColumn from './vune/mentions-column.vune.js';
import type { Column } from '@/deck.js';
import { Paginator } from '@/utility/paginator.js';

defineProps<{ column: Column; isStacked: boolean }>();
const paginator = markRaw(new Paginator('notes/mentions', { limit: 10 }));
</script>
