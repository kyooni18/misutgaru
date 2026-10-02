/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { MotionActivityController } from '@/motion/core/activity.js';

const originalIntersectionObserver = window.IntersectionObserver;

afterEach(() => {
	Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: originalIntersectionObserver });
});

describe('MotionActivityController', () => {
	test('tracks viewport intersection and explicit suspension with one shared controller', () => {
		let callback: IntersectionObserverCallback | null = null;
		const observe = vi.fn();
		const disconnect = vi.fn();
		class FakeIntersectionObserver {
			constructor(next: IntersectionObserverCallback) { callback = next; }
			public observe = observe;
			public disconnect = disconnect;
			public unobserve() {}
			public takeRecords(): IntersectionObserverEntry[] { return []; }
			public root = null;
			public rootMargin = '256px 0px';
			public thresholds = [0];
		}
		Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: FakeIntersectionObserver });

		const element = document.createElement('div');
		const controller = new MotionActivityController(element);
		const states: boolean[] = [];
		controller.subscribe(active => states.push(active), true);
		expect(observe).toHaveBeenCalledWith(element);
		expect(states).toEqual([true]);

		const observerCallback = callback as unknown as IntersectionObserverCallback;
		observerCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
		expect(controller.active).toBe(false);
		controller.setSuspended(true);
		observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		expect(controller.active).toBe(false);
		controller.setSuspended(false);
		expect(controller.active).toBe(true);

		controller.destroy();
		expect(disconnect).toHaveBeenCalled();
	});
});
