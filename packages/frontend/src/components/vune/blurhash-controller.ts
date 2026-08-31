/* SPDX-License-Identifier: AGPL-3.0-only */
import DrawBlurhash from '@/workers/draw-blurhash?worker';
import TestWebGL2 from '@/workers/test-webgl2?worker';
import { WorkerMultiDispatch } from '@@/js/worker-multi-dispatch.js';
import { extractAvgColorFromBlurhash } from '@@/js/extract-avg-color-from-blurhash.js';
import { genId } from '@/utility/id.js';

const isTest = import.meta.env.MODE === 'test' || (typeof window !== 'undefined' && (window as any).isPlaywright);

function fallbackCanvas() {
	const canvas = window.document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	return canvas;
}

const workPromise = new Promise<WorkerMultiDispatch | HTMLCanvasElement>(resolve => {
	if (isTest) {
		resolve(fallbackCanvas());
		return;
	}

	let test: Worker;
	try {
		test = new TestWebGL2();
	} catch {
		resolve(fallbackCanvas());
		return;
	}

	let done = false;
	const finish = (work: WorkerMultiDispatch | HTMLCanvasElement) => {
		if (done) {
			if (work instanceof WorkerMultiDispatch) work.terminate();
			return;
		}

		done = true;
		test.terminate();
		resolve(work);
	};
	test.addEventListener('message', event => {
		if (!event.data.result) {
			finish(fallbackCanvas());
			return;
		}

		try {
			finish(new WorkerMultiDispatch(() => new DrawBlurhash(), Math.min((navigator.hardwareConcurrency || 2) - 1, 4)));
		} catch {
			finish(fallbackCanvas());
		}
	}, { once: true });
	test.addEventListener('error', () => finish(fallbackCanvas()), { once: true });
});

function dimensions(width: number, height: number): [number, number] {
	const ratio = width / height;
	if (!Number.isFinite(ratio) || ratio <= 0) return [64, 64];
	return ratio > 1 ? [Math.round(64 * ratio), 64] : [64, Math.round(64 / ratio)];
}

function closeBitmap(bitmap: CanvasImageSource | undefined) {
	(bitmap as (CanvasImageSource & { close?: () => void }) | undefined)?.close?.();
}

export function blurhashCanvasRef(hash: string | null, onlyAvgColor: boolean, width: number, height: number) {
	const id = genId();
	let canvas: HTMLCanvasElement | null = null;
	let request = 0;
	let bitmap: CanvasImageSource | undefined;
	let disposed = false;
	const [canvasWidth, canvasHeight] = dimensions(width, height);
	const drawImage = (image: CanvasImageSource) => {
		if (!canvas) {
			closeBitmap(bitmap);
			bitmap = image;
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			closeBitmap(image);
			return;
		}

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
		closeBitmap(image);
	};
	const drawAvg = () => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = (hash && extractAvgColorFromBlurhash(hash)) || '#888';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	};
	const onMessage = (event: MessageEvent) => {
		if (event.data.id !== id) return;
		const image = event.data.bitmap as ImageBitmap;
		if (disposed || event.data.request !== request) { image.close(); return; }
		drawImage(image);
	};
	const draw = async () => {
		const current = ++request;
		drawAvg();
		if (!hash || onlyAvgColor || disposed) return;
		const work = await workPromise;
		if (disposed || current !== request) return;
		if (work instanceof WorkerMultiDispatch) work.postMessage({ id, request: current, hash }, undefined);
		else {
			try {
				const { render } = await import('buraha');
				render(hash, work);
				if (!disposed && current === request) drawImage(work);
			} catch (error) {
				console.error('Error occurred during drawing blurhash', error);
			}
		}
	};
	void workPromise.then(work => { if (work instanceof WorkerMultiDispatch) work.addListener(onMessage); void draw(); });
	return (element: HTMLElement | null) => {
		if (element instanceof HTMLCanvasElement) {
			canvas = element;
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;
			if (bitmap) {
				const pending = bitmap;
				bitmap = undefined;
				drawImage(pending);
			} else {
				void draw();
			}
			return;
		}

		disposed = true;
		request += 1;
		closeBitmap(bitmap);
		bitmap = undefined;
		canvas = null;
		void workPromise.then(work => { if (work instanceof WorkerMultiDispatch) work.removeListener(onMessage); });
	};
}
