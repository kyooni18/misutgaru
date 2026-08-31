<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneOverviewHeatmap :src="src" :srcDef="srcDef" :rootClass="$style.root" :onUpdateSrc="setSource"/>
</template>

<script lang="ts" setup>
import VuneOverviewHeatmap from './vune/overview.heatmap.vune?vue-host';
import { useMkSelect } from '@/composables/use-mkselect.js';

const {
	model: src,
	def: srcDef,
} = useMkSelect({
	items: [
		{ label: 'Active users', value: 'active-users' },
		{ label: 'Notes', value: 'notes' },
		{ label: 'AP Requests: inboxReceived', value: 'ap-requests-inbox-received' },
		{ label: 'AP Requests: deliverSucceeded', value: 'ap-requests-deliver-succeeded' },
		{ label: 'AP Requests: deliverFailed', value: 'ap-requests-deliver-failed' },
	],
	initialValue: 'active-users',
});

function setSource(value: 'notes' | 'active-users' | 'ap-requests-inbox-received' | 'ap-requests-deliver-succeeded' | 'ap-requests-deliver-failed'): void {
	src.value = value;
}
</script>

<style lang="scss" module>
.root {
	padding: 20px;
}
</style>
