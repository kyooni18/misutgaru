<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneStreamIndicator :visible="hasDisconnected && prefer.s.serverDisconnectedBehavior === 'quiet'" :zIndex="zIndex" :rootClass="$style.root" :commandClass="$style.command" :onReset="resetDisconnected" :onReload="reload"/>
</template>

<script lang="ts" setup>
import VuneStreamIndicator from './vune/stream-indicator.vune';
import { onUnmounted, ref } from 'vue';
import { useStream } from '@/stream.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';

const zIndex = os.claimZIndex('high');

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

<style lang="scss" module>
.root {
	position: fixed;
	z-index: v-bind(zIndex);
	bottom: calc(var(--MI-minBottomSpacing) + var(--MI-margin));
	right: var(--MI-margin);
	margin: 0;
	padding: 12px;
	font-size: 0.9em;
	max-width: 320px;
}

.command {
	margin-top: 8px;
}
</style>
