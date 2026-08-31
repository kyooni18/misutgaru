<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<NativeMkFormFooter
	:modified="props.form.modified.value"
	:modifiedCount="props.form.modifiedCount.value"
	:canSaving="props.canSaving"
	:onDiscard="props.form.discard"
	:onSave="props.form.save"
/>
</template>

<script lang="ts" setup>
import MkFormFooter from './vune/MkFormFooter.vune';
import type { useForm } from '@/composables/use-form.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeMkFormFooter = createVuneWebHost(MkFormFooter);

const props = withDefaults(defineProps<{
	form: ReturnType<typeof useForm>;
	canSaving?: boolean;
}>(), {
	canSaving: true,
});
</script>
