<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneFavorites :paginator="paginator"/>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import VuneFavorites from './vune/favorites.vune?vue-host';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { Paginator } from '@/utility/paginator.js';

const paginator = markRaw(new Paginator('i/favorites', { limit: 10 }));
definePage(() => ({ title: i18n.ts.favorites, icon: 'ti ti-star' }));
</script>
