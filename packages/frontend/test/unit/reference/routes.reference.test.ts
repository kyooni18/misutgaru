/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Behavioral reference: how real URLs resolve against the production Vue route table.
// A Mün router should resolve the same URLs to the same route names/params.

import { describe, test, assert } from 'vitest';
import { Nirax } from '@/lib/nirax.js';
// router.js must load first: router.definition.js is part of an import cycle through the page components.
import '@/router.js';
import { ROUTE_DEF } from '@/router.definition.js';

const notFound = { name: 'not-found' };
const router = new Nirax(ROUTE_DEF, '/', false, notFound as never);

const resolve = (path: string) => router.resolve(path);

describe('[reference] production routes', () => {
	test('index resolves', () => {
		assert.strictEqual(resolve('/')?.route.name, 'index');
	});

	test('user profile: acct with optional page tab', () => {
		const r = resolve('/@alice@example.com/notes');
		assert.strictEqual(r?.route.name, 'user');
		assert.strictEqual(r?.props.get('acct'), 'alice@example.com');
		assert.strictEqual(r?.props.get('page'), 'notes');
		assert.strictEqual(resolve('/@alice')?.props.get('page'), undefined);
	});

	test('following/followers win over the generic user route', () => {
		assert.strictEqual(resolve('/@alice/following')?.route.path, '/@:acct/following');
		assert.strictEqual(resolve('/@alice/followers')?.route.path, '/@:acct/followers');
	});

	test('user pages with wildcard page name', () => {
		const r = resolve('/@alice/pages/a/b');
		assert.strictEqual(r?.route.path, '/@:username/pages/:pageName(*)');
		assert.strictEqual(r?.props.get('pageName'), 'a/b');
	});

	test('note, list and clip carry their id params', () => {
		const note = resolve('/notes/9abc/reactions');
		assert.strictEqual(note?.route.name, 'note');
		assert.strictEqual(note?.props.get('noteId'), '9abc');
		assert.strictEqual(note?.props.get('initialTab'), 'reactions');
		assert.strictEqual(resolve('/list/l1')?.props.get('listId'), 'l1');
		assert.strictEqual(resolve('/clips/c1')?.props.get('clipId'), 'c1');
	});

	test('chat requires login', () => {
		assert.strictEqual(resolve('/chat')?.route.loginRequired, true);
	});
});
