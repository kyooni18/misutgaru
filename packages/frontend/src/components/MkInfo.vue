<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="_selectable mk-vune-info" :class="{ 'mk-vune-info--warn': warn }">
	<i :class="warn ? 'ti ti-alert-triangle mk-vune-info__icon' : 'ti ti-info-circle mk-vune-info__icon'" aria-hidden="true"></i>
	<div class="mk-vune-info__content"><slot></slot></div>
	<button v-if="closable" class="_button mk-vune-info__close" type="button" :aria-label="i18n.ts.close" @click="emit('close')">
		<i class="ti ti-x" aria-hidden="true"></i>
	</button>
</div>
</template>

<script lang="ts" setup>
import { i18n } from '@/i18n.js';
import './vune/misskey-vune.scss';

withDefaults(defineProps<{
	warn?: boolean;
	closable?: boolean;
}>(), {
	warn: false,
	closable: false,
});

const emit = defineEmits<{
	(ev: 'close'): void;
}>();
</script>
