<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="mk-vune-form-section" :class="{ 'mk-vune-form-section--first': first }">
	<div class="mk-vune-form-section__label" :class="{ 'mk-vune-form-section__label--first': first }"><slot name="label"></slot></div>
	<div class="mk-vune-form-section__description"><slot name="description"></slot></div>
	<div class="mk-vune-form-section__main"><slot></slot></div>
</div>
</template>

<script lang="ts" setup>
import '@/components/vune/misskey-vune.scss';

withDefaults(defineProps<{
	first?: boolean;
}>(), {
	first: false,
});
</script>
