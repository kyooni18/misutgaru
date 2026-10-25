<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	:preferType="'dialog'"
	noBgBlur
	@click="onBgClick()"
	@closed="onModalClosed()"
	@esc="onEsc"
>
	<div :class="$style.formShell">
		<MkProgressiveBlur v-if="prefer.s.useProgressiveBlurForModal" :strength="0.5" :spread="0.5"/>
		<MkPostForm
			ref="form"
			:class="$style.form"
			class="_popup"
			v-bind="props"
			autofocus
			freezeAfterPosted
			@posted="onPosted"
			@cancel="_close()"
			@esc="_close()"
		/>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import type { PostFormProps } from '@/types/post-form.js';
import MkModal from '@/components/MkModal.vue';
import MkPostForm from '@/components/MkPostForm.vue';
import MkProgressiveBlur from '@/components/MkProgressiveBlur.vue';
import { prefer } from '@/preferences.js';

const props = withDefaults(defineProps<PostFormProps & {
	instant?: boolean;
	fixed?: boolean;
	autofocus?: boolean;
}>(), {
	initialLocalOnly: undefined,
});

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');
const form = useTemplateRef('form');

function onPosted() {
	modal.value?.close({
		useSendAnimation: true,
	});
}

async function _close() {
	const canClose = await form.value?.canClose();
	if (!canClose) return;
	form.value?.abortUploader();
	modal.value?.close();
}

function onEsc() {
	_close();
}

function onBgClick() {
	_close();
}

function onModalClosed() {
	emit('closed');
}
</script>

<style lang="scss" module>
.formShell {
	position: relative;
	z-index: 0;
	width: 100%;
	max-width: 520px;
	margin: 0 auto auto auto;
}

.form {
	width: 100%;
}
</style>
