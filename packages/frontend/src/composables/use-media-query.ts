/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onBeforeUnmount, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Reactive matchMedia wrapper. Unlike a resize listener it only wakes Vue when
 * the requested breakpoint actually changes.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return readonly(ref(false));
	}

	const media = window.matchMedia(query);
	const matches = ref(media.matches);
	const update = (event: MediaQueryListEvent) => {
		matches.value = event.matches;
	};

	media.addEventListener('change', update);
	onBeforeUnmount(() => media.removeEventListener('change', update));

	return readonly(matches);
}
