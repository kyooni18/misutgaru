<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneKeyValue :copy="copy" :oneline="oneline" :rootClass="$style.root" :onelineClass="$style.oneline" :keyClass="$style.key" :valueClass="$style.value">
	<template #key><slot name="key"></slot></template>
	<template #value><slot name="value"></slot></template>
</VuneKeyValue>
</template>

<script lang="ts" setup>
import VuneKeyValue from './vune/MkKeyValue.vune';
import { } from 'vue';

const props = withDefaults(defineProps<{
	copy?: string | null;
	oneline?: boolean;
}>(), {
	copy: null,
	oneline: false,
});

</script>

<style lang="scss" module>
.root {
	&.oneline {
		display: flex;

		.key {
			width: 30%;
			font-size: 1em;
			padding: 0 8px 0 0;
		}

		.value {
			width: 70%;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
}

.key {
	font-size: 0.85em;
	padding: 0 0 0.25em 0;
	opacity: 0.75;
}
</style>
