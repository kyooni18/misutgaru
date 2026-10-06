<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button :class="$style.root" class="_button" :aria-label="i18n.ts.note" @click="os.post()">
	<i class="ti ti-pencil"></i>
</button>
</template>

<script lang="ts" setup>
import { onUnmounted } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

// Keep the end of the feed clear of the floating button.
window.document.body.style.setProperty('--MI-minBottomSpacing', 'var(--MI-minBottomSpacingMobile)');
onUnmounted(() => {
	window.document.body.style.setProperty('--MI-minBottomSpacing', '0px');
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	z-index: 10;
	right: 16px;
	bottom: max(16px, env(safe-area-inset-bottom, 0px));
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 100%;
	font-size: 18px;
	color: var(--MI_THEME-fgOnAccent);
	background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
	box-shadow: 0 6px 16px -6px var(--MI_THEME-shadow);
	transition: filter var(--MI-durFast) var(--MI-easeOut), transform var(--MI-durFast) var(--MI-easeOut);

	&:hover {
		filter: brightness(1.08);
	}

	&:active {
		filter: brightness(0.94);
		transform: scale(0.95);
	}
}
</style>
