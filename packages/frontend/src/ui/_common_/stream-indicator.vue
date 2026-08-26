<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneStreamIndicator :visible="hasDisconnected && prefer.s.serverDisconnectedBehavior === 'quiet'" :zIndex="zIndex" :onReset="resetDisconnected" :onReload="reload"/>
</template>

<script lang="ts" setup>
import StreamIndicator from './vune/stream-indicator.vune';
import { onUnmounted, ref } from 'vue';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { useStream } from '@/stream.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';

const zIndex = os.claimZIndex('high');
const VuneStreamIndicator = createVuneWebHost(StreamIndicator);

const hasDisconnected = ref(false);

function onDisconnected() {
	hasDisconnected.value = true;
}

function resetDisconnected() {
	hasDisconnected.value = false;
}

function reload() {
	window.location.reload();
}

if (store.s.realtimeMode) {
	useStream().on('_disconnected_', onDisconnected);

	onUnmounted(() => {
		useStream().off('_disconnected_', onDisconnected);
	});
}
</script>

<style lang="scss">
.mk-vune-stream-indicator {
	position: fixed;
	z-index: v-bind(zIndex);
	bottom: calc(var(--MI-minBottomSpacing) + var(--MI-margin));
	right: var(--MI-margin);
	margin: 0;
	padding: 12px;
	width: max-content !important;
	font-size: 0.9em;
	max-width: 320px;
}

.mk-vune-stream-indicator__message,
.mk-vune-stream-indicator__command {
	width: max-content !important;
	justify-content: flex-start !important;
}

.mk-vune-stream-indicator__command {
	margin-top: 8px;
}

.mk-vune-stream-indicator__button {
	position: relative;
	z-index: 1;
	display: block;
	width: max-content;
	padding: 6px 12px;
	box-sizing: border-box;
	border-radius: 5px;
	overflow: clip;
	font-size: 90%;
	text-align: center;
	text-decoration: none;
	box-shadow: none;
	transition: background 0.1s ease;

	&--secondary {
		background: var(--MI_THEME-buttonBg);

		&:not(:disabled):hover,
		&:not(:disabled):active {
			background: var(--MI_THEME-buttonHoverBg);
		}
	}

	&--primary {
		color: var(--MI_THEME-fgOnAccent);
		font-weight: bold;
		background: var(--MI_THEME-accent);

		&:not(:disabled):hover {
			background: hsl(from var(--MI_THEME-accent) h s calc(l + 5));
		}

		&:not(:disabled):active {
			background: hsl(from var(--MI_THEME-accent) h s calc(l - 5));
		}
	}
}
</style>
