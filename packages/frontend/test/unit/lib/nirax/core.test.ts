/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { NiraxCore } from '@/lib/nirax-core.js';
import type { RouteDef } from '@/lib/nirax-core.js';

const home = { name: 'home' };
const privatePage = { name: 'private' };
const loginFallback = { name: 'login-fallback' };

const routes = [{
	path: '/',
	component: home,
}, {
	path: '/private',
	component: privatePage,
	loginRequired: true,
}] as const satisfies RouteDef[];

describe('[NIRAX core] renderer-neutral state', () => {
	test('navigates without renderer refs or lifecycle helpers', () => {
		const router = new NiraxCore(routes, '/', true, loginFallback);
		const changes: string[] = [];
		router.addListener('change', ({ fullPath }) => changes.push(fullPath));

		router.init();
		router.pushByPath('/private');

		if (!('component' in router.current.route)) throw new Error('expected component route');
		expect(router.current.route.component).toBe(privatePage);
		expect(changes).toEqual(['/private']);
	});

	test('keeps login fallback behavior in the core', () => {
		const router = new NiraxCore(routes, '/', false, loginFallback);
		router.init();
		router.pushByPath('/private');

		if (!('component' in router.current.route)) throw new Error('expected component route');
		expect(router.current.route.component).toBe(loginFallback);
		expect(router.current.props.get('showLoginPopup')).toBe(true);
	});
});
