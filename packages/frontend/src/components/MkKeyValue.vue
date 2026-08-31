<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="mk-vune-key-value" :class="{ 'mk-vune-key-value--oneline': oneline }">
	<div class="mk-vune-key-value__key"><slot name="key"></slot></div>
	<div class="_selectable mk-vune-key-value__value">
		<slot name="value"></slot>
		<button v-if="copy" class="_textButton mk-vune-key-value__copy" type="button" :title="i18n.ts.copy" @click="copyToClipboard(copy)">
			<i class="ti ti-copy" aria-hidden="true"></i>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { i18n } from '@/i18n.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import './vune/misskey-vune.scss';

withDefaults(defineProps<{
	copy?: string | null;
	oneline?: boolean;
}>(), {
	copy: null,
	oneline: false,
});
</script>
