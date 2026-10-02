/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface MotionClock {
	now(): number;
	requestFrame(callback: FrameRequestCallback): number;
	cancelFrame(handle: number): void;
}

export const browserMotionClock: MotionClock = {
	now: () => performance.now(),
	requestFrame: callback => window.requestAnimationFrame(callback),
	cancelFrame: handle => window.cancelAnimationFrame(handle),
};
