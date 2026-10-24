/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defineComponent, isVNode, withDirectives } from 'vue';
import type { DirectiveArguments, PropType, VNode } from 'vue';

// Mün views cannot carry Vue directives (v-tooltip, v-hotkey, ...). Wrap the
// node in this component from a .mun file and the directives land on it
// without adding any DOM of its own.
export const MunDirectives = defineComponent({
	name: 'MunDirectives',
	props: {
		directives: { type: Array as PropType<DirectiveArguments>, required: true },
	},
	setup(props, { slots }) {
		return () => {
			const vnode = (slots.default?.() ?? []).flat(Infinity as 1).find((child): child is VNode => isVNode(child));
			return vnode ? withDirectives(vnode, props.directives) : null;
		};
	},
});
