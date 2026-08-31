<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="mk-vune-disable-section">
	<div :class="{ 'mk-vune-disable-section__content--disabled': disabled }" :inert="disabled ? true : undefined"><slot></slot></div>
	<div v-if="disabled" class="mk-vune-disable-section__cover"></div>
</div>
</template>

<script lang="ts" setup>
import './vune/misskey-vune.scss';

withDefaults(defineProps<{
	disabled?: boolean;
}>(), {
	disabled: false,
});
</script>
