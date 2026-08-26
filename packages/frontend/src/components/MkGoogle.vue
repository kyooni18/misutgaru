<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeGoogle :query="query" :q="q" :classes="$style" :onUpdateQuery="(value: string) => query = value" :onSearch="search"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneGoogle from './vune/MkGoogle.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeGoogle = createVuneWebHost(VuneGoogle);

const props = defineProps<{
	q: string;
}>();

const query = ref(props.q);

const search = () => {
	const sp = new URLSearchParams();
	sp.append('q', query.value);
	window.open(`https://www.google.com/search?${sp.toString()}`, '_blank', 'noopener');
};
</script>

<style lang="scss" module>
.root {
	display: flex;
	margin: 8px 0;
}

.input {
	flex-shrink: 1;
	padding: 10px;
	width: 100%;
	height: 40px;
	font-size: 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 4px 0 0 4px;
	-webkit-appearance: textfield;
}

.button {
	flex-shrink: 0;
	margin: 0;
	padding: 0 16px;
	border: solid 1px var(--MI_THEME-divider);
	border-left: none;
	border-radius: 0 4px 4px 0;

	&:active {
		box-shadow: 0 2px 4px rgba(#000, 0.15) inset;
	}
}
</style>
