/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onBeforeUnmount, shallowRef } from 'vue';
import type { Component, ShallowRef } from 'vue';
import type { EventEmitter } from 'eventemitter3';
import { NiraxCore } from './nirax-core.js';
import type { VuneRouteTarget } from '@/vune/route-target.js';
import type {
	PathResolvedResult as CorePathResolvedResult,
	RouteDef as CoreRouteDef,
	RouterEvents as CoreRouterEvents,
} from './nirax-core.js';

export type RouteTarget = Component | VuneRouteTarget;
export type RouteDef = CoreRouteDef<RouteTarget>;
export type PathResolvedResult = CorePathResolvedResult<RouteTarget>;
export type RouterEvents = CoreRouterEvents<RouteTarget>;
export type { RouterFlag } from './nirax-core.js';

/** Vue binding for the framework-neutral Nirax router core. */
export class Nirax<DEF extends RouteDef[]> extends NiraxCore<RouteTarget, DEF> {
	public currentRef: ShallowRef<PathResolvedResult>;
	public currentRoute: ShallowRef<RouteDef>;

	constructor(routes: DEF, currentFullPath: string, isLoggedIn: boolean, notFoundPageComponent: RouteTarget) {
		super(routes, currentFullPath, isLoggedIn, notFoundPageComponent);
		this.currentRef = shallowRef(this.current);
		this.currentRoute = shallowRef(this.current.route);
	}

	protected override onCurrentChanged(resolved: PathResolvedResult): void {
		this.currentRef.value = resolved;
		this.currentRoute.value = resolved.route;
	}

	public useListener<E extends keyof RouterEvents>(event: E, listener: EventEmitter.EventListener<RouterEvents, E>) {
		this.addListener(event, listener);

		onBeforeUnmount(() => {
			this.removeListener(event, listener);
		});
	}
}
