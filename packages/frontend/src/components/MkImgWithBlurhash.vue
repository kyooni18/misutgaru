<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="root" :class="['chromatic-ignore', $style.root, { [$style.cover]: cover }]" :title="title ?? ''">
	<TransitionGroup
		:duration="prefer.s.animation && props.transition?.duration || undefined"
		:enterActiveClass="prefer.s.animation && props.transition?.enterActiveClass || undefined"
		:leaveActiveClass="prefer.s.animation && (props.transition?.leaveActiveClass ?? $style.transition_leaveActive) || undefined"
		:enterFromClass="prefer.s.animation && props.transition?.enterFromClass || undefined"
		:leaveToClass="prefer.s.animation && props.transition?.leaveToClass || undefined"
		:enterToClass="prefer.s.animation && props.transition?.enterToClass || undefined"
		:leaveFromClass="prefer.s.animation && props.transition?.leaveFromClass || undefined"
	>
		<MkBlurhash
			key="canvas"
			:class="$style.canvas"
			:blurhash="hash ?? null"
			:height="props.height"
			:width="props.width"
			:onlyAvgColor="props.onlyAvgColor"
			:show="hide"
		/>
		<img
			v-show="!hide"
			key="img"
			ref="img"
			:height="imgHeight ?? undefined"
			:width="imgWidth ?? undefined"
			:class="$style.img"
			:src="effectiveSrc ?? undefined"
			:title="title ?? undefined"
			:alt="alt ?? undefined"
			:data-marker="marker ?? undefined"
			:loading="loading"
			decoding="async"
			draggable="false"
			tabindex="-1"
			style="-webkit-user-drag: none;"
		/>
	</TransitionGroup>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch, ref } from 'vue';
import { prefer } from '@/preferences.js';
import MkBlurhash from '@/components/MkBlurhash.vue';

const lazyLoadCallbacks = new WeakMap<Element, () => void>();
const lazyLoadObserver = typeof IntersectionObserver === 'undefined'
	? null
	: new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			lazyLoadCallbacks.get(entry.target)?.();
			lazyLoadCallbacks.delete(entry.target);
			lazyLoadObserver?.unobserve(entry.target);
		}
	}, {
		rootMargin: '640px 0px',
	});

const props = withDefaults(defineProps<{
	transition?: {
		duration?: number | { enter: number; leave: number; };
		enterActiveClass?: string;
		leaveActiveClass?: string;
		enterFromClass?: string;
		leaveToClass?: string;
		enterToClass?: string;
		leaveFromClass?: string;
	} | null;
	src?: string | null;
	hash?: string | null;
	alt?: string | null;
	title?: string | null;
	height?: number;
	width?: number;
	cover?: boolean;
	forceBlurhash?: boolean;
	onlyAvgColor?: boolean; // 軽量化のためにBlurhashを使わずに平均色だけを描画
	marker?: string;
	loading?: 'eager' | 'lazy';
}>(), {
	transition: null,
	src: null,
	alt: '',
	title: null,
	height: 64,
	width: 64,
	cover: true,
	forceBlurhash: false,
	onlyAvgColor: false,
	loading: 'eager',
});

const root = useTemplateRef('root');
const img = useTemplateRef('img');
const loaded = ref(false);
const imgWidth = ref(props.width);
const imgHeight = ref(props.height);
const hide = computed(() => !loaded.value || props.forceBlurhash);
const shouldLoad = ref(props.loading === 'eager' || lazyLoadObserver == null);
const effectiveSrc = computed(() => shouldLoad.value ? props.src : null);

function armLazyLoad() {
	const el = root.value;
	if (!el) return;

	lazyLoadObserver?.unobserve(el);
	lazyLoadCallbacks.delete(el);

	if (props.loading === 'eager' || lazyLoadObserver == null) {
		shouldLoad.value = true;
		return;
	}

	if (shouldLoad.value) return;
	lazyLoadCallbacks.set(el, () => {
		shouldLoad.value = true;
	});
	lazyLoadObserver.observe(el);
}

let decodeRequest = 0;

function waitForDecode() {
	const request = ++decodeRequest;
	const source = effectiveSrc.value;
	loaded.value = false;

	if (source != null && source !== '') {
		nextTick()
			.then(() => img.value?.decode())
			.then(() => {
				if (request !== decodeRequest || effectiveSrc.value !== source) return;
				loaded.value = true;
			}, error => {
				if (request !== decodeRequest) return;
				console.log('Error occurred during decoding image', img.value, error);
			});
	}
}

watch([() => props.width, () => props.height, root], () => {
	const ratio = props.width / props.height;
	const clientWidth = root.value?.clientWidth ?? 300;
	imgWidth.value = clientWidth;
	imgHeight.value = Math.round(clientWidth / ratio);
}, {
	immediate: true,
});

watch(effectiveSrc, () => {
	waitForDecode();
}, {
	immediate: true,
});

watch(() => props.loading, () => {
	if (props.loading === 'lazy') shouldLoad.value = false;
	armLazyLoad();
});

onMounted(armLazyLoad);

onBeforeUnmount(() => {
	decodeRequest++;
	if (!root.value) return;
	lazyLoadObserver?.unobserve(root.value);
	lazyLoadCallbacks.delete(root.value);
});
</script>

<style lang="scss" module>
.transition_leaveActive {
	position: absolute;
	top: 0;
	left: 0;
}
.root {
	position: relative;
	width: 100%;
	height: 100%;

	&.cover {
		> .canvas,
		> .img {
			object-fit: cover;
		}
	}
}

.canvas,
.img {
	display: block;
	width: 100%;
	height: 100%;
}

.canvas {
	object-fit: contain;
}

.img {
	object-fit: contain;
}
</style>
