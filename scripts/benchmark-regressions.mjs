#!/usr/bin/env node
/* SPDX-License-Identifier: AGPL-3.0-only */
import { performance } from 'node:perf_hooks';
import { bindMotionStyles, flushDomCommits, ownStyleAnimation, cancelStyleAnimations } from '../packages/modules/Vune/packages/animation/src/dom/index.js';
import { motionValue } from '../packages/modules/Vune/packages/animation/src/index.js';

function fakeElement() {
	return {
		style: {},
		setAttribute() {},
	};
}

const elementCount = Number(process.env.MISUTGARU_BENCH_ELEMENTS ?? 2048);
const frameCount = Number(process.env.MISUTGARU_BENCH_FRAMES ?? 60);
const x = motionValue(0);
const opacity = motionValue(1);
const elements = Array.from({ length: elementCount }, fakeElement);
const unbind = elements.map(element => bindMotionStyles(element, { x, opacity }));
flushDomCommits();

const start = performance.now();
let committed = 0;
for (let frame = 1; frame <= frameCount; frame += 1) {
	x.set(frame * 0.75);
	opacity.set(1 - ((frame % 20) / 40));
	committed += flushDomCommits();
}
const elapsedMs = performance.now() - start;
for (const release of unbind) release();

const expectedCommits = elementCount * frameCount;
if (committed !== expectedCommits) {
	throw new Error(`DOM batch regression: expected ${expectedCommits} committed element states, got ${committed}`);
}

let firstCancelled = 0;
let secondCancelled = 0;
let thirdCancelled = 0;
const never = new Promise(() => {});
const first = { finished: never, cancel() { firstCancelled += 1; } };
const second = { finished: never, cancel() { secondCancelled += 1; } };
const third = { finished: never, cancel() { thirdCancelled += 1; } };
const ownerElement = fakeElement();
ownStyleAnimation(ownerElement, 'opacity', first);
ownStyleAnimation(ownerElement, 'transform', second);
ownStyleAnimation(ownerElement, 'opacity', third);
if (firstCancelled !== 1 || secondCancelled !== 0 || thirdCancelled !== 0) {
	throw new Error('Style ownership regression: replacing opacity disturbed an unrelated property or failed to cancel the previous owner');
}
cancelStyleAnimations(ownerElement);
if (secondCancelled !== 1 || thirdCancelled !== 1) {
	throw new Error('Style ownership regression: final cancellation did not release all active property owners');
}

const metrics = {
	elementCount,
	frameCount,
	committed,
	elapsedMs: Number(elapsedMs.toFixed(3)),
	microsecondsPerElementCommit: Number(((elapsedMs * 1000) / committed).toFixed(4)),
};
console.log(JSON.stringify(metrics, null, 2));
