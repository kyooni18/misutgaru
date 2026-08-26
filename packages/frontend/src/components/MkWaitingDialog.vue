<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :preferType="'dialog'" :zPriority="'high'" @click="success ? done() : () => {}" @closed="emit('closed')">
	<VuneWaitingDialogHost :success="success" :text="text" :classes="$style"/>
</MkModal>
</template>

<script lang="ts" setup>
import { watch, useTemplateRef } from 'vue';
import VuneWaitingDialog from './vune/MkWaitingDialog.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import MkModal from '@/components/MkModal.vue';

const VuneWaitingDialogHost = createVuneWebHost(VuneWaitingDialog);

const modal = useTemplateRef('modal');

const props = defineProps<{
	success: boolean;
	showing: boolean;
	text?: string | null;
}>();

const emit = defineEmits<{
	(ev: 'done'): void;
	(ev: 'closed'): void;
}>();

function done() {
	emit('done');
	modal.value?.close();
}

watch(() => props.showing, () => {
	if (!props.showing) done();
});
</script>

<style lang="scss" module>
.root {
	margin: auto;
	position: relative;
	padding: 32px;
	box-sizing: border-box;
	text-align: center;
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
	width: 250px;

	&.iconOnly {
		padding: 0;
		width: 96px;
		height: 96px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
}

.icon {
	font-size: 32px;

	&.success {
		color: var(--MI_THEME-accent);
	}

	&.waiting {
		opacity: 0.7;
	}
}

.text {
	margin-top: 16px;
}
</style>
