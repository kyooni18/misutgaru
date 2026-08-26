<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFederationJobQueue :tab="tab" :headerActions="headerActions" :headerTabs="headerTabs" :onTabChange="value => tab = value" :onPromote="promoteAllQueues" :onClear="clear"/>
</template>

<script lang="ts" setup>
import VuneFederationJobQueue from './vune/federation-job-queue.vune';
import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

export type ApQueueDomain = 'deliver' | 'inbox';

const tab: Ref<ApQueueDomain> = ref('deliver');

function clear() {
	os.confirm({
		type: 'warning',
		title: i18n.ts.clearQueueConfirmTitle,
		text: i18n.ts.clearQueueConfirmText,
	}).then(({ canceled }) => {
		if (canceled) return;

		os.apiWithDialog('admin/queue/clear', { queue: tab.value, state: '*' });
	});
}

function promoteAllQueues() {
	os.confirm({
		type: 'warning',
		title: i18n.ts.retryAllQueuesConfirmTitle,
		text: i18n.ts.retryAllQueuesConfirmText,
	}).then(({ canceled }) => {
		if (canceled) return;

		os.apiWithDialog('admin/queue/promote-jobs', { queue: tab.value });
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'deliver',
	title: 'Deliver',
}, {
	key: 'inbox',
	title: 'Inbox',
}]);

definePage(() => ({
	title: i18n.ts.federationJobs,
	icon: 'ti ti-clock-play',
}));
</script>
