<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<canvas
	v-show="show"
	ref="canvas"
	:width="canvasWidth"
	:height="canvasHeight"
	draggable="false"
	tabindex="-1"
	style="-webkit-user-drag: none;"
></canvas>
</template>

<script lang="ts">
import DrawBlurhash from '@/workers/draw-blurhash?worker';
import TestWebGL2 from '@/workers/test-webgl2?worker';
import { WorkerMultiDispatch } from '@@/js/worker-multi-dispatch.js';

// テスト環境で Web Worker インスタンスは作成できない
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const isTest = (import.meta.env.MODE === 'test' || window.isPlaywright);

function createFallbackCanvas() {
	const canvas = window.document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	return canvas;
}

const canvasPromise = new Promise<WorkerMultiDispatch | HTMLCanvasElement>(resolve => {
	if (isTest) {
		resolve(createFallbackCanvas());
		return;
	}

	let testWorker: Worker;
	try {
		testWorker = new TestWebGL2();
	} catch (error) {
		console.warn('[MkBlurhash] Worker initialization failed, using canvas fallback', error);
		resolve(createFallbackCanvas());
		return;
	}

	let settled = false;
	const finish = (work: WorkerMultiDispatch | HTMLCanvasElement) => {
		if (settled) {
			if (work instanceof WorkerMultiDispatch) work.terminate();
			return;
		}
		settled = true;
		testWorker.terminate();
		resolve(work);
	};

	testWorker.addEventListener('message', event => {
		if (!event.data.result) {
			finish(createFallbackCanvas());
			return;
		}

		try {
			finish(new WorkerMultiDispatch(
				() => new DrawBlurhash(),
				Math.min((navigator.hardwareConcurrency || 2) - 1, 4),
			));
		} catch (error) {
			console.warn('[MkBlurhash] Draw worker initialization failed, using canvas fallback', error);
			finish(createFallbackCanvas());
		}
	}, { once: true });
	testWorker.addEventListener('error', event => {
		console.warn('[MkBlurhash] WebGL capability worker failed, using canvas fallback', event);
		finish(createFallbackCanvas());
	}, { once: true });
});

</script>

<script lang="ts" setup>
import { watch, ref, shallowRef, useTemplateRef, onMounted, onUnmounted } from 'vue';
import { genId } from '@/utility/id.js';
import { extractAvgColorFromBlurhash } from '@@/js/extract-avg-color-from-blurhash.js';

const props = withDefaults(defineProps<{
	blurhash: string | null;
	onlyAvgColor?: boolean;
	width?: number;
	height?: number;
	// v-showが何故か動作しないため
	show?: boolean;
}>(), {
	onlyAvgColor: false,
	width: 64,
	height: 64,
	show: true,
});

const canvas = useTemplateRef('canvas');
const canvasWidth = ref(64);
const canvasHeight = ref(64);
const viewId = genId();
const bitmapTmp = shallowRef<CanvasImageSource | undefined>();
let drawRequest = 0;

watch([() => props.width, () => props.height, canvas], () => {
	const ratio = props.width / props.height;
	if (!Number.isFinite(ratio) || ratio <= 0) {
		canvasWidth.value = 64;
		canvasHeight.value = 64;
	} else if (ratio > 1) {
		canvasWidth.value = Math.round(64 * ratio);
		canvasHeight.value = 64;
	} else {
		canvasWidth.value = 64;
		canvasHeight.value = Math.round(64 / ratio);
	}
}, {
	immediate: true,
});

watch(() => props.blurhash, () => {
	draw();
});

function closeBitmap(bitmap: CanvasImageSource | undefined) {
	const closable = bitmap as CanvasImageSource & { close?: () => void } | undefined;
	closable?.close?.();
}

function drawImage(bitmap: CanvasImageSource) {
	// canvasがない（mountedされていない）場合はTmpに保存しておく
	if (!canvas.value) {
		if (bitmapTmp.value !== bitmap) closeBitmap(bitmapTmp.value);
		bitmapTmp.value = bitmap;
		return;
	}

	// canvasがあれば描画する
	if (bitmapTmp.value !== bitmap) closeBitmap(bitmapTmp.value);
	bitmapTmp.value = undefined;
	const ctx = canvas.value.getContext('2d');
	if (!ctx) {
		closeBitmap(bitmap);
		return;
	}
	ctx.drawImage(bitmap, 0, 0, canvasWidth.value, canvasHeight.value);
	closeBitmap(bitmap);
}

function drawAvg() {
	if (!canvas.value) return;

	const color = (props.blurhash != null && extractAvgColorFromBlurhash(props.blurhash)) || '#888';

	const ctx = canvas.value.getContext('2d');
	if (!ctx) return;

	// avgColorでお茶をにごす
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);
}

async function draw() {
	const request = ++drawRequest;
	if (isTest && props.blurhash == null) return;

	drawAvg();

	const hash = props.blurhash;
	if (hash == null || props.onlyAvgColor) return;

	const work = await canvasPromise;
	if (request !== drawRequest) return;
	if (work instanceof WorkerMultiDispatch) {
		work.postMessage(
			{
				id: viewId,
				request,
				hash,
			},
			undefined,
		);
	} else {
		try {
			const { render } = await import('buraha');
			if (request !== drawRequest) return;
			render(hash, work);
			if (request !== drawRequest) return;
			drawImage(work);
		} catch (error) {
			console.error('Error occurred during drawing blurhash', error);
		}
	}
}

function workerOnMessage(event: MessageEvent) {
	if (event.data.id !== viewId) return;
	const bitmap = event.data.bitmap as ImageBitmap;
	if (event.data.request !== drawRequest) {
		bitmap.close();
		return;
	}
	drawImage(bitmap);
}

canvasPromise.then(work => {
	if (work instanceof WorkerMultiDispatch) {
		work.addListener(workerOnMessage);
	}

	draw();
});

onMounted(() => {
	// drawImageがmountedより先に呼ばれている場合はここで描画する
	if (bitmapTmp.value) {
		drawImage(bitmapTmp.value);
	} else {
		// onlyAvgColor の場合でも、worker 初期化が mount より先に終わることがある。
		drawAvg();
	}
});

onUnmounted(() => {
	drawRequest++;
	closeBitmap(bitmapTmp.value);
	bitmapTmp.value = undefined;
	canvasPromise.then(work => {
		if (work instanceof WorkerMultiDispatch) {
			work.removeListener(workerOnMessage);
		}
	});
});
</script>
