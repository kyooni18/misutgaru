<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneMyAntennasIndex :antennas="antennas" :headerActions="headerActions" :headerTabs="headerTabs" :addClass="$style.add" :antennaClass="$style.antenna" :nameClass="$style.name"/>
</template>

<script lang="ts" setup>
import VuneMyAntennasIndex from '@/pages/vune/my-antennas-index.vune?vue-host';
import { onActivated, computed } from 'vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { antennasCache } from '@/cache.js';

const antennas = computed(() => antennasCache.value.value ?? []);

function _fetch_() {
	antennasCache.fetch();
}

_fetch_();

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: () => {
		antennasCache.delete();
		_fetch_();
	},
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.manageAntennas,
	icon: 'ti ti-antenna',
}));

onActivated(() => {
	antennasCache.fetch();
});
</script>

<style lang="scss" module>
.add {
	margin: 0 auto 16px auto;
}

.antenna {
	display: block;
	padding: 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 6px;

	&:hover {
		border: solid 1px var(--MI_THEME-accent);
		text-decoration: none;
	}
}

.name {
	font-weight: bold;
}
</style>
