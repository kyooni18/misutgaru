/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onBeforeUnmount, shallowRef, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { MotionActivityController } from '@/motion/core/activity.js';
import type { MotionActivityOptions } from '@/motion/core/activity.js';

export type AnimationActivityOptions = MotionActivityOptions;

/**
 * Keep decorative/content animations dormant when their owner cannot be seen.
 * The browser-native activity controller lives in the shared motion subsystem;
 * this composable only adapts it to Vue lifecycle/reactivity.
 */
export function useAnimationActivity(
	target: Ref<HTMLElement | null | undefined>,
	options: AnimationActivityOptions = {},
): ShallowRef<boolean> {
	const controller = new MotionActivityController(null, options);
	const active = shallowRef(controller.active);
	const unsubscribe = controller.subscribe(next => {
		active.value = next;
	}, true);
	const stopTargetWatch = watch(target, element => controller.setElement(element ?? null), { immediate: true });

	onBeforeUnmount(() => {
		stopTargetWatch();
		unsubscribe();
		controller.destroy();
	});

	return active;
}
