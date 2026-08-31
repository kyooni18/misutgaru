<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div ref="motionHost" style="display: contents;">
	<VuneToastHost :message="message" :zIndex="zIndex"/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import MkToast from './vune/MkToast.vune';
import type { MotionHandle } from '@/vune/motion.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { uiMotion, vuneMotion } from '@/vune/motion.js';

const props = defineProps<{ message: string }>();
const emit = defineEmits<{ (ev: 'closed'): void }>();

const VuneToastHost = createVuneWebHost(MkToast);
const zIndex = os.claimZIndex('high');
const motionHost = ref<HTMLElement | null>(null);
let timer: number | null = null;
let motion: MotionHandle | null = null;
let closed = false;

function toastElement(): HTMLElement | null {
	return motionHost.value?.querySelector('.mk-vune-toast') as HTMLElement | null;
}

async function closeToast() {
	if (closed) return;
	closed = true;
	const target = toastElement();
	if (target && prefer.s.animation) {
		motion = vuneMotion.animateElement(target, [
			{ opacity: 1, transform: 'translateY(0)' },
			{ opacity: 0, transform: 'translateY(-100%)' },
		], { animation: uiMotion.surfaceLeave, fill: 'forwards' });
		await motion.finished;
	}
	emit('closed');
}

onMounted(async () => {
	await nextTick();
	const target = toastElement();
	if (target && prefer.s.animation) {
		motion = vuneMotion.animateElement(target, [
			{ opacity: 0, transform: 'translateY(-100%)' },
			{ opacity: 1, transform: 'translateY(0)' },
		], { animation: uiMotion.surfaceEnter, fill: 'both' });
	}
	timer = window.setTimeout(() => { void closeToast(); }, 4000);
});

onBeforeUnmount(() => {
	if (timer !== null) window.clearTimeout(timer);
	motion?.cancel();
});
</script>
