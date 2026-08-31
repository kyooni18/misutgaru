/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defineAsyncComponent, defineComponent, h } from 'vue';
import type { Component } from 'vue';
import { definePage } from '@/page.js';
import { createPageVuneWebHost } from '@/vune/compat-vue.js';
import { isVuneRouteTarget, loadVuneRouteTarget } from '@/vune/route-target.js';
import type { VuneRouteProps, VuneRouteTarget } from '@/vune/route-target.js';

const vueHostCache = new WeakMap<VuneRouteTarget, Component>();

function createVueHost(target: VuneRouteTarget): Component {
	return defineAsyncComponent(async () => {
		const module = await loadVuneRouteTarget(target);
		const NativeHost = createPageVuneWebHost(module.default);
		if (target.metadata == null && target.onEnter == null) return NativeHost;

		return defineComponent({
			name: 'MisutgaruVuneRoutePageHost',
			inheritAttrs: false,
			setup(_props, { attrs }) {
				const routeProps = attrs as VuneRouteProps;
				if (target.metadata != null) definePage(() => target.metadata!(routeProps));
				void target.onEnter?.(routeProps);
				return () => h(NativeHost, attrs);
			},
		});
	});
}

/** Resolve a renderer-neutral route target for the remaining Vue router hosts. */
export function resolveVueRouteTarget(target: Component | VuneRouteTarget): Component {
	if (!isVuneRouteTarget(target)) return target;
	let cached = vueHostCache.get(target);
	if (cached == null) {
		cached = createVueHost(target);
		vueHostCache.set(target, cached);
	}
	return cached;
}
