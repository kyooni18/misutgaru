/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onScopeDispose, shallowRef, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { dragGesture } from '../core/index.js';
import type { DragGestureHandle, DragGestureOptions } from '../core/index.js';

export function useDragGesture(
	target: Readonly<Ref<HTMLElement | null | undefined>>,
	options: DragGestureOptions = {},
): ShallowRef<DragGestureHandle | null> {
	const handle = shallowRef<DragGestureHandle | null>(null);
	const stop = watch(target, element => {
		handle.value?.destroy();
		handle.value = element == null ? null : dragGesture(element, options);
	}, { immediate: true });

	onScopeDispose(() => {
		stop();
		handle.value?.destroy();
		handle.value = null;
	});

	return handle;
}
