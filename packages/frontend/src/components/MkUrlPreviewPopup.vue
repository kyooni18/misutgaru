<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div ref="motionHost" style="display: contents;">
	<VuneUrlPreviewPopup :url="url" :zIndex="zIndex" :top="top" :left="left"/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VuneUrlPreviewPopup from './vune/MkUrlPreviewPopup.vune?vue-host';
import type { MotionHandle } from '@/vune/motion.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { surfaceMotionAnimation, surfaceScaleKeyframes, vuneMotion } from '@/vune/motion.js';

const props = defineProps<{ showing: boolean; url: string; anchorElement: HTMLElement }>();
const emit = defineEmits<{ (ev: 'closed'): void }>();

// The popup can be mounted after the hover state has already ended. Signal
// closure immediately so the owner can dispose it instead of leaving a
// permanently mounted hidden preview behind.
if (!props.showing) emit('closed');

const zIndex = os.claimZIndex('middle');
const top = ref(0);
const left = ref(0);
const motionHost = ref<HTMLElement | null>(null);
let motion: MotionHandle | null = null;
let closed = false;

function target(): HTMLElement | null {
	return motionHost.value?.querySelector('.mk-vune-url-preview-popup') as HTMLElement | null;
}

function position() {
	const rect = props.anchorElement.getBoundingClientRect();
	left.value = Math.max((rect.left + (props.anchorElement.offsetWidth / 2)) - (300 / 2), 6) + window.scrollX;
	top.value = rect.top + props.anchorElement.offsetHeight + window.scrollY;
}

async function enter() {
	await nextTick();
	const el = target();
	if (!el) return;
	motion?.cancel();
	if (!prefer.s.animation) {
		el.style.opacity = '1';
		el.style.transform = 'scale(1)';
		return;
	}
	motion = vuneMotion.animateElement(el, surfaceScaleKeyframes('enter'), {
		animation: surfaceMotionAnimation('enter'), fill: 'both',
	});
}

async function leave() {
	if (closed) return;
	closed = true;
	const el = target();
	if (el && prefer.s.animation) {
		motion?.cancel();
		motion = vuneMotion.animateElement(el, surfaceScaleKeyframes('leave'), {
			animation: surfaceMotionAnimation('leave'), fill: 'forwards',
		});
		await motion.finished;
	}
	emit('closed');
}

onMounted(() => {
	position();
	if (props.showing) void enter();
});
watch(() => props.showing, showing => {
	if (showing) { closed = false; void enter(); } else void leave();
});
onBeforeUnmount(() => motion?.cancel());
</script>
