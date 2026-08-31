<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="wrapEl" :class="$style.wrap">
	<span
		ref="contentEl"
		:class="[$style.content, {
			[$style.paused]: paused || !animationActive,
			[$style.reverse]: reverse,
		}]"
		:style="{ '--marquee-distance': marqueeDistance }"
	>
		<span v-for="key in repeat" :key="key" :class="$style.text">
			<slot></slot>
		</span>
	</span>
</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { useAnimationActivity } from '@/composables/use-animation-activity.js';

const props = withDefaults(defineProps<{
	duration?: number;
	repeat?: number;
	paused?: boolean;
	reverse?: boolean;
}>(), {
	duration: 15,
	repeat: 2,
	paused: false,
	reverse: false,
});

const contentEl = useTemplateRef('contentEl');
const wrapEl = useTemplateRef('wrapEl');
const animationActive = useAnimationActivity(wrapEl);
const marqueeDistance = computed(() => `${-(100 / Math.max(1, props.repeat))}%`);
let resizeObserver: ResizeObserver | null = null;

function calcDuration() {
	if (contentEl.value == null) return;
	const eachLength = contentEl.value.offsetWidth / Math.max(1, props.repeat);
	if (!Number.isFinite(eachLength) || eachLength <= 0) return;
	const factor = 3000;
	const duration = props.duration / ((1 / eachLength) * factor);
	contentEl.value.style.animationDuration = `${duration}s`;
}

watch(() => [props.duration, props.repeat], calcDuration);

onMounted(() => {
	calcDuration();
	if (typeof ResizeObserver !== 'undefined' && contentEl.value) {
		resizeObserver = new ResizeObserver(calcDuration);
		resizeObserver.observe(contentEl.value);
	}
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
});
</script>

<style lang="scss" module>
.wrap {
	overflow: clip;
	contain: layout paint;

	&:hover .content {
		animation-play-state: paused;
	}
}

.content {
	display: inline-block;
	white-space: nowrap;
	will-change: transform;
	animation-name: marquee;
	animation-timing-function: linear;
	animation-iteration-count: infinite;
	animation-play-state: running;
}

.text {
	display: inline-block;
}

.paused {
	animation-play-state: paused;
}

.reverse {
	animation-direction: reverse;
}

@keyframes marquee {
	0% { transform: translate3d(0, 0, 0); }
	100% { transform: translate3d(var(--marquee-distance), 0, 0); }
}
</style>
