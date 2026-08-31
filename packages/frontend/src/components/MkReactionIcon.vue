<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeReactionIconHost
	v-bind="$attrs"
	:reaction="reaction"
	:noStyle="noStyle"
	:emojiUrl="emojiUrl"
	:onRef="setElementRef"
/>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from 'vue';
import NativeReactionIcon from './vune/MkReactionIcon.vune';
import { useTooltip } from '@/composables/use-tooltip.js';
import * as os from '@/os.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

defineOptions({ inheritAttrs: false });

const NativeReactionIconHost = createVuneWebHost(NativeReactionIcon);

const props = defineProps<{
	reaction: string;
	noStyle?: boolean;
	emojiUrl?: string;
	withTooltip?: boolean;
}>();

const elRef = ref<HTMLElement | null>(null);

function setElementRef(element: unknown): void {
	elRef.value = element instanceof HTMLElement ? element : null;
}

if (props.withTooltip) {
	useTooltip(elRef, (showing) => {
		if (elRef.value == null) return;
		const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkReactionTooltip.vue')), {
			showing,
			reaction: props.reaction.replace(/^:(\w+):$/, ':$1@.:'),
			anchorElement: elRef.value,
		}, {
			closed: () => dispose(),
		});
	});
}

defineExpose({ $el: elRef });
</script>
