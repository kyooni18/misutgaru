/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Misskey's migration boundary between Vune and Vue. Vune owns the new view
 * graph; Vue remains available only where an existing component/slot has not
 * been migrated yet.
 */
import {
	defineComponent,
	h,
} from 'vue';
import type { Component as VueComponentType, Slots, VNode } from 'vue';
import {
	Component as VuneVueComponent,
	VuneView,
} from '@vune-ui/vue';
import { initializersOf } from 'vune-ui';
import type { ViewConstructor, ViewGraphValue } from 'vune-ui';

/** Vue leaves bare boolean attributes as an empty string when there is no runtime prop schema. */
export function vuneBoolean(value: unknown, defaultValue = false): boolean {
	if (value === undefined || value === null) return defaultValue;
	if (value === false || value === 'false') return false;
	return true;
}

/**
 * Expose a Vune graph as a normal Vue component while the surrounding Misskey
 * tree is still Vue. Props/slots are read at the boundary; rendering itself is
 * delegated to the official @vune-ui/vue renderer.
 */
export function createVuneComponent<Props extends Record<string, unknown> = Record<string, unknown>>(
	body: (props: Readonly<Props>, slots: Readonly<Slots>) => ViewGraphValue,
) {
	return defineComponent({
		name: 'MisskeyVuneView',
		inheritAttrs: false,
		setup(_props, { attrs, slots }) {
			return () => h(VuneView, {
				render: () => body(attrs as Props, slots),
			});
		},
	});
}

const SlotOutlet = defineComponent({
	name: 'VuneVueSlotOutlet',
	inheritAttrs: false,
	props: {
		render: { type: Function, required: false },
	},
	setup(props) {
		return () => typeof props.render === 'function' ? (props.render as () => VNode[])() : null;
	},
});

/** Keep a Vue slot only at the migration boundary; the surrounding tree remains Vune. */
export function VueSlot(
	slot: ((props?: Record<string, unknown>) => VNode[]) | undefined,
	props?: Record<string, unknown>,
): ViewGraphValue {
	return VuneVueComponent(SlotOutlet, {
		render: () => {
			if (typeof slot !== 'function') return [];
			return props === undefined ? slot() : slot(props);
		},
	});
}

function isAdaptedVueComponent(value: unknown): value is ViewConstructor {
	if (typeof value !== 'function') return false;
	return initializersOf(value).some(item => item.signature === 'VueComponent(props?)');
}

/** Embed a Vue-only component until a Vune replacement exists. */
export function VueComponent(
	component: VueComponentType,
	props: Record<string, unknown> = {},
	slots: Record<string, ViewGraphValue | ((...args: unknown[]) => ViewGraphValue)> = {},
): ViewGraphValue {
	const adaptedProps = { ...props, slots };
	// The Vune compiler already turns `.vue` imports into the official
	// `foreignComponent(...)` View constructor. Calling the compatibility helper
	// around one of those constructors must therefore use its single props
	// initializer; passing `(props, slots)` creates the observed
	// `VueComponent(object, object)` mismatch.
	if (isAdaptedVueComponent(component)) return component(adaptedProps);
	return VuneVueComponent(component as object, adaptedProps as never);
}
