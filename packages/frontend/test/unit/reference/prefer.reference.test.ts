/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Behavioral reference for client preference state: local commit semantics and the cloud sync wire format.

import { describe, test, assert, beforeEach, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api, misskeyApiGet: api }));

// test/setup.unit.ts mocks '@/preferences.js' globally; this test needs the real manager.
const { prefer } = await vi.importActual<typeof import('@/preferences.js')>('@/preferences.js');

const SYNC_SCOPE = ['client', 'preferences', 'sync'];

describe('[reference] prefer', () => {
	beforeEach(() => {
		api.mockReset();
		prefer.disableSync('keepCw');
		prefer.commit('keepCw', true);
	});

	test('commit updates the plain and reactive state and emits committed', () => {
		const committed = vi.fn();
		prefer.on('committed', committed);
		prefer.commit('keepCw', false);
		prefer.off('committed', committed);

		assert.strictEqual(prefer.s.keepCw, false);
		assert.strictEqual(prefer.r.keepCw.value, false);
		assert.strictEqual(committed.mock.calls[0][0].key, 'keepCw');
		assert.strictEqual(committed.mock.calls[0][0].value, false);
	});

	test('committing an unchanged value is a no-op', () => {
		const committed = vi.fn();
		prefer.on('committed', committed);
		prefer.commit('keepCw', true);
		prefer.off('committed', committed);

		assert.strictEqual(committed.mock.calls.length, 0);
	});

	test('does not touch the backend while sync is off', () => {
		prefer.commit('keepCw', false);
		assert.strictEqual(api.mock.calls.length, 0);
	});

	test('with sync on, commit reads then writes i/registry under scope client/preferences/sync', async () => {
		prefer.getMatchedRecordOf('keepCw')[2].sync = true;
		api.mockImplementation(async (endpoint: string) => {
			if (endpoint === 'i/registry/get') throw Object.assign(new Error('no key'), { code: 'NO_SUCH_KEY' });
		});

		prefer.commit('keepCw', false);
		await vi.waitFor(() => assert.strictEqual(api.mock.calls.length, 2));

		const [getCall, setCall] = api.mock.calls;
		assert.strictEqual(getCall[0], 'i/registry/get');
		assert.deepStrictEqual(getCall[1], { scope: SYNC_SCOPE, key: 'default:keepCw' });
		assert.strictEqual(setCall[0], 'i/registry/set');
		assert.deepStrictEqual(setCall[1].scope, SYNC_SCOPE);
		assert.strictEqual(setCall[1].key, 'default:keepCw');
		// value is a list of [scope, value] pairs, one per preference scope
		assert.strictEqual(setCall[1].value.length, 1);
		assert.strictEqual(setCall[1].value[0][1], false);
	});
});
