<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<canvas ref="canvasEl" style="display: block; width: 100%; height: 100%; pointer-events: none;"></canvas>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef } from 'vue';
import isChromatic from 'chromatic/isChromatic';
import vertexShaderSource from './MkAnimBg.vertex.glsl';
import fragmentShaderSource from './MkAnimBg.fragment.glsl';
import { initShaderProgram } from '@/utility/webgl.js';

const canvasEl = useTemplateRef('canvasEl');

const props = withDefaults(defineProps<{
	scale?: number;
	focus?: number;
}>(), {
	scale: 1.0,
	focus: 1.0,
});

let handle: ReturnType<typeof window['requestAnimationFrame']> | null = null;
let frameTimer: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibilityObserver: IntersectionObserver | null = null;
let disposeWebGl = () => {};
let removeDocumentVisibilityListener = () => {};

const FRAME_INTERVAL = 1000 / 30;

onMounted(() => {
	const canvas = canvasEl.value!;
	const initialWidth = Math.max(1, Math.round(canvas.offsetWidth));
	const initialHeight = Math.max(1, Math.round(canvas.offsetHeight));
	canvas.width = initialWidth;
	canvas.height = initialHeight;

	const maybeGl = canvas.getContext('webgl2', { premultipliedAlpha: true });
	if (maybeGl == null) return;

	const gl = maybeGl;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

	const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
	if (shaderProgram == null) {
		if (positionBuffer) gl.deleteBuffer(positionBuffer);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return;
	}

	gl.useProgram(shaderProgram);
	const u_resolution = gl.getUniformLocation(shaderProgram, 'u_resolution');
	const u_time = gl.getUniformLocation(shaderProgram, 'u_time');
	const u_spread = gl.getUniformLocation(shaderProgram, 'u_spread');
	const u_speed = gl.getUniformLocation(shaderProgram, 'u_speed');
	const u_warp = gl.getUniformLocation(shaderProgram, 'u_warp');
	const u_focus = gl.getUniformLocation(shaderProgram, 'u_focus');
	const u_itensity = gl.getUniformLocation(shaderProgram, 'u_itensity');
	const u_scale = gl.getUniformLocation(shaderProgram, 'u_scale');
	gl.uniform2fv(u_resolution, [canvas.width, canvas.height]);
	gl.uniform1f(u_spread, 1.0);
	gl.uniform1f(u_speed, 1.0);
	gl.uniform1f(u_warp, 1.0);
	gl.uniform1f(u_focus, props.focus);
	gl.uniform1f(u_itensity, 0.5);
	gl.uniform2fv(u_scale, [props.scale, props.scale]);

	const vertex = gl.getAttribLocation(shaderProgram, 'position');
	gl.enableVertexAttribArray(vertex);
	gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);

	const vertices = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

	const syncCanvasSize = () => {
		const width = Math.max(1, Math.round(canvas.offsetWidth));
		const height = Math.max(1, Math.round(canvas.offsetHeight));
		if (canvas.width === width && canvas.height === height) return;
		canvas.width = width;
		canvas.height = height;
		gl.uniform2fv(u_resolution, [width, height]);
		gl.viewport(0, 0, width, height);
	};

	resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncCanvasSize);
	resizeObserver?.observe(canvas);

	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
	if (isChromatic() || reducedMotion) {
		gl.uniform1f(u_time, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	} else {
		let intersecting = true;
		let documentVisible = window.document.visibilityState === 'visible';
		const active = () => intersecting && documentVisible;

		const stop = () => {
			if (handle !== null) {
				window.cancelAnimationFrame(handle);
				handle = null;
			}
			if (frameTimer !== null) {
				window.clearTimeout(frameTimer);
				frameTimer = null;
			}
		};
		const schedule = () => {
			if (!active() || handle !== null || frameTimer !== null) return;
			// A decorative shader does not benefit from matching a 120/144 Hz
			// display. Delay the next RAF instead of requesting every display frame
			// and merely skipping most draws, which would still wake the renderer.
			frameTimer = window.setTimeout(() => {
				frameTimer = null;
				if (active()) handle = window.requestAnimationFrame(render);
			}, FRAME_INTERVAL);
		};
		const render = (timeStamp: number) => {
			handle = null;
			if (!active()) return;
			gl.uniform1f(u_time, timeStamp);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			schedule();
		};
		const start = () => {
			if (!active()) return;
			schedule();
		};
		const onDocumentVisibility = () => {
			documentVisible = window.document.visibilityState === 'visible';
			if (documentVisible) start();
			else stop();
		};
		window.document.addEventListener('visibilitychange', onDocumentVisibility);
		removeDocumentVisibilityListener = () => window.document.removeEventListener('visibilitychange', onDocumentVisibility);

		if (typeof IntersectionObserver === 'undefined') {
			start();
		} else {
			visibilityObserver = new IntersectionObserver(entries => {
				intersecting = entries.some(entry => entry.isIntersecting);
				if (intersecting) start();
				else stop();
			}, { rootMargin: '128px' });
			visibilityObserver.observe(canvas);
		}
	}

	disposeWebGl = () => {
		if (positionBuffer) gl.deleteBuffer(positionBuffer);
		gl.deleteProgram(shaderProgram);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	};
});

onUnmounted(() => {
	if (handle !== null) {
		window.cancelAnimationFrame(handle);
		handle = null;
	}
	if (frameTimer !== null) {
		window.clearTimeout(frameTimer);
		frameTimer = null;
	}
	removeDocumentVisibilityListener();
	removeDocumentVisibilityListener = () => {};
	resizeObserver?.disconnect();
	resizeObserver = null;
	visibilityObserver?.disconnect();
	visibilityObserver = null;
	disposeWebGl();
});
</script>

<style lang="scss" module>
</style>
