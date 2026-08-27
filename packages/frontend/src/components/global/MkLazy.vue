<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="$style.root">
	<div v-if="!showing" :class="$style.placeholder"></div>
	<slot v-else></slot>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onActivated, onBeforeUnmount, ref, useTemplateRef } from 'vue';

const rootEl = useTemplateRef('rootEl');
const showing = ref(false);

const observer = new IntersectionObserver(
	(entries) => {
		if (entries.some((entry) => entry.isIntersecting)) {
			showing.value = true;
			observer.disconnect();
		}
	},
);

function observeIfNeeded() {
	if (showing.value || !rootEl.value) return;
	observer.observe(rootEl.value);
}

onMounted(() => {
	nextTick(() => {
		observeIfNeeded();
	});
});

onActivated(() => {
	nextTick(() => {
		observeIfNeeded();
	});
});

onBeforeUnmount(() => {
	observer.disconnect();
});
</script>

<style lang="scss" module>
.root {
	display: block;
}

.placeholder {
	display: block;
	min-height: 150px;
}
</style>
