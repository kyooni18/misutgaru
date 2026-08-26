/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const misskeyApi = vi.fn();

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi }));

describe('fetchMovedUser', () => {
	beforeEach(() => {
		vi.resetModules();
		misskeyApi.mockReset();
	});

	test('deduplicates repeated lookups for the same moved account', async () => {
		const user = { id: 'user-1', username: 'moved', host: null };
		misskeyApi.mockResolvedValue(user);
		const { fetchMovedUser } = await import('@/components/MkAccountMoved.data.js');

		const first = fetchMovedUser(user.id);
		const second = fetchMovedUser(user.id);

		expect(first).toBe(second);
		await expect(first).resolves.toBe(user);
		expect(misskeyApi).toHaveBeenCalledTimes(1);
	});

	test('evicts failed lookups so a later render can retry', async () => {
		misskeyApi.mockRejectedValueOnce(new Error('temporary failure'));
		misskeyApi.mockResolvedValueOnce({ id: 'user-2', username: 'recovered', host: null });
		const { fetchMovedUser } = await import('@/components/MkAccountMoved.data.js');

		await expect(fetchMovedUser('user-2')).rejects.toThrow('temporary failure');
		await expect(fetchMovedUser('user-2')).resolves.toMatchObject({ id: 'user-2' });
		expect(misskeyApi).toHaveBeenCalledTimes(2);
	});
});
