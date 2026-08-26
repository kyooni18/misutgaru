<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneDatabase :databasePromiseFactory="databasePromiseFactory"/>
</template>

<script lang="ts" setup>
import VuneDatabase from './vune/database.vune';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const databasePromiseFactory = () => misskeyApi('admin/get-table-stats').then(res => Object.entries(res).sort((a, b) => b[1].size - a[1].size));
definePage(() => ({ title: i18n.ts.database, icon: 'ti ti-database' }));
</script>
