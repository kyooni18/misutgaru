/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ViewConstructor } from 'vune-ui';
import type { PageMetadata } from '@/page.js';

export type VuneRouteModule = {
	readonly default: ViewConstructor;
};

export type VuneRouteProps = Readonly<Record<string, string | boolean>>;

export type VuneRouteTarget = {
	readonly kind: 'vune-route';
	readonly load: () => Promise<VuneRouteModule>;
	readonly metadata?: (props: VuneRouteProps) => PageMetadata;
	readonly onEnter?: (props: VuneRouteProps) => void | Promise<void>;
};

const moduleCache = new WeakMap<VuneRouteTarget, Promise<VuneRouteModule>>();

export function vuneRoute(
	load: VuneRouteTarget['load'],
	metadata?: VuneRouteTarget['metadata'],
	onEnter?: VuneRouteTarget['onEnter'],
): VuneRouteTarget {
	return { kind: 'vune-route', load, metadata, onEnter };
}

export function isVuneRouteTarget(value: unknown): value is VuneRouteTarget {
	return typeof value === 'object'
		&& value !== null
		&& (value as { kind?: unknown }).kind === 'vune-route'
		&& typeof (value as { load?: unknown }).load === 'function';
}

/** Share one lazy module request across Vue compatibility and future native route hosts. */
export function loadVuneRouteTarget(target: VuneRouteTarget): Promise<VuneRouteModule> {
	const cached = moduleCache.get(target);
	if (cached != null) return cached;

	const pending = Promise.resolve()
		.then(target.load)
		.catch((error) => {
			if (moduleCache.get(target) === pending) moduleCache.delete(target);
			throw error;
		});
	moduleCache.set(target, pending);
	return pending;
}
