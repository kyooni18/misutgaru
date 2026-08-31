<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFukidashi :tail="tail" :negativeMargin="negativeMargin" :shadow="shadow" :accented="accented" :fullWidth="fullWidth"><slot></slot></VuneFukidashi>
</template>

<script setup lang="ts">
import VuneFukidashi from './vune/MkFukidashi.vune?vue-host';
withDefaults(defineProps<{
	tail?: 'left' | 'right' | 'none';
	negativeMargin?: boolean;
	shadow?: boolean;
	accented?: boolean;
	fullWidth?: boolean;
}>(), {
	tail: 'right',
	negativeMargin: false,
	shadow: false,
	accented: false,
	fullWidth: false,
});
</script>
