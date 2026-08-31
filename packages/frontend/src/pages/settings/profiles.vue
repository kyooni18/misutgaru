<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneProfiles :backups="backups" :onDelete="del"/>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import VuneProfiles from './vune/profiles.vune?vue-host';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { deleteCloudBackup, listCloudBackups } from '@/preferences/utility.js';

const backups = await listCloudBackups();

function del(backup: { name: string }): void {
	deleteCloudBackup(backup.name);
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts._preferencesProfile.manageProfiles,
	icon: 'ti ti-settings-cog',
}));
</script>

<style lang="scss" module>
</style>
