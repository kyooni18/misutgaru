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
	type Component as VueComponentType,
	type Slots,
	type VNode,
} from 'vue';
import {
	Component as VuneVueComponent,
	VuneView,
} from '@vune-ui/vue';
import type { ViewGraphValue } from 'vune-ui';

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
export function VueSlot(slot: (() => VNode[]) | undefined): ViewGraphValue {
	return VuneVueComponent(SlotOutlet, { render: slot });
}

/** Embed a Vue-only component until a Vune replacement exists. */
export function VueComponent(
	component: VueComponentType,
	props: Record<string, unknown> = {},
	slots: Record<string, ViewGraphValue | ((...args: unknown[]) => ViewGraphValue)> = {},
): ViewGraphValue {
	return VuneVueComponent(component as object, { ...props, slots } as never);
}
