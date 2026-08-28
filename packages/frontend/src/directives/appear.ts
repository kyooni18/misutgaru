/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { throttle } from 'throttle-debounce';
import type { Directive } from 'vue';
import type { Awaitable } from '@/types/misc.js';
import { getScrollContainer } from '@@/js/scroll.js';

type ObserverState = {
	observer: IntersectionObserver;
};

const observers = new WeakMap<HTMLElement, ObserverState>();

function attach(src: HTMLElement, callback: (() => Awaitable<void>) | null | undefined): void {
	const previous = observers.get(src);
	previous?.observer.disconnect();
	observers.delete(src);
	if (callback == null) return;

	const check = throttle<IntersectionObserverCallback>(500, (entries) => {
		if (entries.some(entry => entry.isIntersecting)) {
			void callback();
		}
	});

	// Timeline feeds live inside their own scrollable page/column. Using that
	// container as the observer root keeps appearance detection tied to the
	// scroll that actually moves the target instead of relying on viewport
	// clipping through an ancestor with overflow.
	const observer = new IntersectionObserver(check, {
		root: getScrollContainer(src),
	});
	observer.observe(src);
	observers.set(src, { observer });
}

export const appearDirective = {
	mounted(src, binding) {
		attach(src, binding.value);
	},

	updated(src, binding) {
		if (binding.value !== binding.oldValue) {
			attach(src, binding.value);
		}
	},

	beforeUnmount(src) {
		const observer = observers.get(src);
		if (observer) {
			observer.observer.disconnect();
			observers.delete(src);
		}
	},
} as Directive<HTMLElement, (() => Awaitable<void>) | null | undefined>;
