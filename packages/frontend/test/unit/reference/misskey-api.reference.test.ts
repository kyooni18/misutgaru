/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Behavioral reference for backend communication: the wire format every Mün API call must reproduce.

import { describe, test, assert, beforeEach, vi } from 'vitest';
import { misskeyApi, misskeyApiGet, pendingApiRequestsCount } from '@/utility/misskey-api.js';

// misskey-api.ts calls window.fetch directly, so stub that rather than the global fetch mock.
const base = vi.fn();
const fm = Object.assign(base, {
	mockResponseOnce: (body: string, init?: { status: number }) => base.mockResolvedValueOnce(new Response(body || null, { status: init?.status ?? 200 })),
});

describe('[reference] misskeyApi', () => {
	beforeEach(() => {
		fm.mockReset();
		vi.stubGlobal('fetch', fm);
		window.fetch = fm as never;
	});

	test('POSTs JSON to <apiUrl>/<endpoint> without cookies or caching', async () => {
		fm.mockResponseOnce(JSON.stringify({ ok: 1 }));
		const res = await misskeyApi('ping' as never, { a: 1 } as never, null);
		assert.deepStrictEqual(res, { ok: 1 });
		const [url, init] = fm.mock.calls[0];
		assert.match(String(url), /\/ping$/);
		assert.strictEqual(init.method, 'POST');
		assert.strictEqual(init.credentials, 'omit');
		assert.strictEqual(init.cache, 'no-cache');
		assert.strictEqual(init.headers['Content-Type'], 'application/json');
		assert.deepStrictEqual(JSON.parse(init.body), { a: 1, i: null });
	});

	test('explicit token is sent as body.i', async () => {
		fm.mockResponseOnce('{}');
		await misskeyApi('ping' as never, {} as never, 'tok');
		assert.strictEqual(JSON.parse(fm.mock.calls[0][1].body).i, 'tok');
	});

	test('204 resolves undefined', async () => {
		fm.mockResponseOnce('', { status: 204 });
		assert.strictEqual(await misskeyApi('ping' as never, {} as never, null), undefined);
	});

	test('non-200 rejects with body.error and the pending counter returns to 0', async () => {
		fm.mockResponseOnce(JSON.stringify({ error: { code: 'NO_SUCH_NOTE' } }), { status: 400 });
		const p = misskeyApi('ping' as never, {} as never, null);
		assert.strictEqual(pendingApiRequestsCount.value, 1);
		try { await p; assert.fail('should reject'); } catch (e) { assert.deepStrictEqual(e, { code: 'NO_SUCH_NOTE' }); }
		await Promise.resolve();
		assert.strictEqual(pendingApiRequestsCount.value, 0);
	});

	test('rejects absolute-URL endpoints synchronously', () => {
		assert.throws(() => misskeyApi('https://evil/x' as never), /invalid endpoint/);
	});

	test('GET variant puts params in the query string', async () => {
		fm.mockResponseOnce('{}');
		await misskeyApiGet('ping' as never, { limit: 5 } as never);
		const [url, init] = fm.mock.calls[0];
		assert.match(String(url), /\/ping\?limit=5$/);
		assert.strictEqual(init.method, 'GET');
	});
});
