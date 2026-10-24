<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<Transition
		:enterActiveClass="prefer.s.animation ? $style.transition_toast_enterActive : ''"
		:leaveActiveClass="prefer.s.animation ? $style.transition_toast_leaveActive : ''"
		:enterFromClass="prefer.s.animation ? $style.transition_toast_enterFrom : ''"
		:leaveToClass="prefer.s.animation ? $style.transition_toast_leaveTo : ''"
		appear @afterLeave="emit('closed')"
	>
		<div v-if="showing" :class="$style.root" :style="{ zIndex }">
			<MkProgressiveBlur/>
			<div style="padding: 16px 24px;">
				{{ message }}
			</div>
		</div>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import MkProgressiveBlur from '@/components/MkProgressiveBlur.vue';
import { onMounted, ref } from 'vue';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';

defineProps<{
	message: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const zIndex = os.claimZIndex('high');
const showing = ref(true);

onMounted(() => {
	window.setTimeout(() => {
		showing.value = false;
	}, 4000);
});
</script>

<style lang="scss" module>
// Fade through --MI-fade rather than opacity, which would cut the edge blur off
// from the page behind the toast while it animates.
.transition_toast_enterActive,
.transition_toast_leaveActive {
	transition: --MI-fade var(--MI-dur) var(--MI-easeOut), transform var(--MI-dur) var(--MI-easeOut) !important;
}
.transition_toast_enterFrom,
.transition_toast_leaveTo {
	--MI-fade: 0;
	transform: translateY(-8px);
}

.root {
	background: color-mix(in srgb, var(--MI_THEME-panel) calc(88% * var(--MI-fade)), transparent);
	position: fixed;
	left: 0;
	right: 0;
	top: 50px;
	margin: 0 auto;
	margin-top: 16px;
	min-width: 300px;
	max-width: calc(100% - 32px);
	width: min-content;
	box-shadow: 0 4px 16px rgb(0 0 0 / calc(0.3 * var(--MI-fade)));
	border-radius: 8px;
	isolation: isolate;
	text-align: center;
	pointer-events: none;

	> :not([data-progressive-blur]) {
		opacity: var(--MI-fade);
	}
}
</style>
