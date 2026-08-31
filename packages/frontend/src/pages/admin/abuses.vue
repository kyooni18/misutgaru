<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAdminAbuses
	:state="state"
	:stateDef="stateDef"
	:reporterOrigin="reporterOrigin"
	:reporterOriginDef="reporterOriginDef"
	:targetUserOrigin="targetUserOrigin"
	:targetUserOriginDef="targetUserOriginDef"
	:paginator="paginator"
	:rootClass="$style.root"
	:subMenusClass="$style.subMenus"
	:inputsClass="$style.inputs"
	:headerActions="headerActions"
	:headerTabs="headerTabs"
	:onState="setState"
	:onReporterOrigin="setReporterOrigin"
	:onTargetUserOrigin="setTargetUserOrigin"
	:onResolved="resolved"
/>
</template>

<script lang="ts" setup>
import { computed, ref, markRaw } from 'vue';
import VuneAdminAbuses from './vune/abuses.vune?vue-host';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { store } from '@/store.js';
import { Paginator } from '@/utility/paginator.js';

const {
	model: state,
	def: stateDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'all' },
		{ label: i18n.ts.unresolved, value: 'unresolved' },
		{ label: i18n.ts.resolved, value: 'resolved' },
	],
	initialValue: 'unresolved',
});
const {
	model: reporterOrigin,
	def: reporterOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const {
	model: targetUserOrigin,
	def: targetUserOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const searchUsername = ref('');
const searchHost = ref('');

function setState(value: 'all' | 'resolved' | 'unresolved'): void {
	state.value = value;
}

function setReporterOrigin(value: 'local' | 'remote' | 'combined'): void {
	reporterOrigin.value = value;
}

function setTargetUserOrigin(value: 'local' | 'remote' | 'combined'): void {
	targetUserOrigin.value = value;
}

const paginator = markRaw(new Paginator('admin/abuse-user-reports', {
	limit: 10,
	computedParams: computed(() => ({
		state: state.value,
		reporterOrigin: reporterOrigin.value,
		targetUserOrigin: targetUserOrigin.value,
	})),
}));

function resolved(reportId: string) {
	paginator.removeItem(reportId);
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.abuseReports,
	icon: 'ti ti-exclamation-circle',
}));
</script>

<style module lang="scss">
.root {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: stretch;
}

.subMenus {
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	align-items: center;
}

.inputs {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
}
</style>
