<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div ref="motionHost" style="display: contents;">
	<VuneFolderPageHost :pageId="pageId" :zIndex="zIndex" :onClose="closePage"/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import MkFolderPage from './vune/MkFolderPage.vune';
import type { MotionHandle } from '@/vune/motion.js';
import { claimZIndex } from '@/os.js';
import { prefer } from '@/preferences.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { uiMotion, vuneMotion } from '@/vune/motion.js';

const props = withDefaults(defineProps<{ pageId: number }>(), { pageId: 0 });
const emit = defineEmits<{ (_: 'closed'): void }>();

const VuneFolderPageHost = createVuneWebHost(MkFolderPage);
const zIndex = claimZIndex('low');
const motionHost = ref<HTMLElement | null>(null);
const motions: MotionHandle[] = [];
let closing = false;

function elements() {
	return {
		bg: motionHost.value?.querySelector('.mk-vune-folder-page__bg') as HTMLElement | null,
		content: motionHost.value?.querySelector('.mk-vune-folder-page__content') as HTMLElement | null,
	};
}

async function closePage() {
	if (closing) return;
	closing = true;
	const { bg, content } = elements();
	if (prefer.s.animation && bg && content) {
		const fade = vuneMotion.animateElement(bg, [{ opacity: 1 }, { opacity: 0 }], {
			animation: uiMotion.backdrop, fill: 'forwards',
		});
		const slide = vuneMotion.animateElement(content, [
			{ transform: 'translateX(0)' },
			{ transform: 'translateX(100%)' },
		], { animation: uiMotion.drawer, fill: 'forwards' });
		motions.push(fade, slide);
		await Promise.all([fade.finished, slide.finished]);
	}
	emit('closed');
}

onMounted(async () => {
	await nextTick();
	const { bg, content } = elements();
	if (!prefer.s.animation || !bg || !content) return;
	const fade = vuneMotion.animateElement(bg, [{ opacity: 0 }, { opacity: 1 }], {
		animation: uiMotion.backdrop, fill: 'both',
	});
	const slide = vuneMotion.animateElement(content, [
		{ transform: 'translateX(100%)' },
		{ transform: 'translateX(0)' },
	], { animation: uiMotion.drawer, fill: 'both' });
	motions.push(fade, slide);
});

onBeforeUnmount(() => {
	for (const motion of motions) motion.cancel();
});
</script>
