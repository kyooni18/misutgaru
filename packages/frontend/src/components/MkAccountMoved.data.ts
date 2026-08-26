/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';

const movedUserRequests = new Map<string, Promise<Misskey.entities.UserLite>>();
const MAX_CACHED_MOVED_USERS = 128;

/** Share in-flight and completed lookups across repeated moved-account notices. */
export function fetchMovedUser(userId: string): Promise<Misskey.entities.UserLite> {
	const cached = movedUserRequests.get(userId);
	if (cached) return cached;

	if (movedUserRequests.size >= MAX_CACHED_MOVED_USERS) {
		const oldest = movedUserRequests.keys().next().value;
		if (oldest !== undefined) movedUserRequests.delete(oldest);
	}

	const request = misskeyApi('users/show', { userId }).catch(error => {
		movedUserRequests.delete(userId);
		throw error;
	});
	movedUserRequests.set(userId, request);
	return request;
}
