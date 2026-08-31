/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onBeforeUnmount, shallowRef, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';

export interface AnimationActivityOptions {
	/** Resume shortly before the element enters the viewport. */
	rootMargin?: string;
}

/**
 * Keep decorative/content animations dormant when their owner cannot be seen.
 *
 * Browser animation throttling for hidden tabs is intentionally not treated as
 * sufficient: pausing explicitly also stops style invalidation and animation
 * bookkeeping while a long timeline keeps off-screen rows mounted.
 */
export function useAnimationActivity(
	target: Ref<HTMLElement | null | undefined>,
	options: AnimationActivityOptions = {},
): ShallowRef<boolean> {
	const active = shallowRef(typeof window === 'undefined' || window.document.visibilityState === 'visible');
	let intersecting = true;
	let observer: IntersectionObserver | null = null;

	const update = () => {
		active.value = (typeof window === 'undefined' || window.document.visibilityState === 'visible') && intersecting;
	};

	const attach = (element: HTMLElement | null | undefined) => {
		observer?.disconnect();
		observer = null;
		if (!element) return;

		if (typeof IntersectionObserver === 'undefined') {
			intersecting = true;
			update();
			return;
		}

		observer = new IntersectionObserver((records) => {
			const record = records[records.length - 1];
			if (!record) return;
			intersecting = record.isIntersecting;
			update();
		}, {
			root: null,
			rootMargin: options.rootMargin ?? '256px 0px',
			threshold: 0,
		});
		observer.observe(element);
	};

	const stopTargetWatch = watch(target, attach, { immediate: true });
	const onVisibilityChange = () => update();
	if (typeof window !== 'undefined') window.document.addEventListener('visibilitychange', onVisibilityChange);

	onBeforeUnmount(() => {
		stopTargetWatch();
		observer?.disconnect();
		observer = null;
		if (typeof window !== 'undefined') window.document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	return active;
}
