/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import push from 'web-push';
import { PushNotificationService } from '@/core/PushNotificationService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import Logger from '@/logger.js';

afterEach(() => vi.restoreAllMocks());

describe('2026.10.1 fork integration contracts', () => {
	test('push delivery uses the checked HTTPS agent and retains fork TTL/cache behavior', async () => {
		vi.spyOn(push, 'setVapidDetails').mockImplementation(() => undefined);
		const send = vi.spyOn(push, 'sendNotification').mockResolvedValue({} as never);
		const agent = {};
		const getAgentForHttps = vi.fn(() => agent);
		const service = new PushNotificationService(
			{ url: 'https://local.example' } as never,
			{ enableServiceWorker: true, swPublicKey: 'public', swPrivateKey: 'private' } as never,
			{} as never, {} as never,
			{ getLogger: () => new Logger('push-test') } as never,
			{ register: () => () => undefined } as never,
			{ getAgentForHttps } as never,
		);
		vi.spyOn(Reflect.get(service, 'subscriptionsCache'), 'fetch').mockResolvedValue([
			{ endpoint: 'http://127.0.0.1/invalid', sendReadMessage: true },
			{ endpoint: 'https://push.example/subscription', sendReadMessage: true, auth: 'auth', publickey: 'key' },
		] as never);
		try {
			await service.pushNotification('user', 'readAllNotifications', undefined);
			expect(getAgentForHttps).toHaveBeenCalledExactlyOnceWith(new URL('https://push.example/subscription'));
			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0][2]).toMatchObject({ agent, TTL: 60, urgency: 'low' });
		} finally {
			service.onApplicationShutdown();
		}
	});

	test('hidden hashtag normalization is applied before batched ranking', async () => {
		const pipeline = vi.fn();
		const service = new HashtagService(
			{} as never, { hiddenTags: ['ＴＥＳＴ'], sensitiveWords: [] } as never,
			{ pipeline } as never, {} as never, {} as never, {} as never, {} as never,
			{ isKeyWordIncluded: () => false } as never,
		);
		await service.updateHashtagsRanking('test', 'user');
		expect(pipeline).not.toHaveBeenCalled();
	});

	test('anonymous endpoints enforce default role policies without user dereference', async () => {
		const getUserPolicies = vi.fn(async () => ({ canSearchNotes: false }));
		const getUserRoles = vi.fn();
		const exec = vi.fn();
		const service = new ApiCallService(
			{} as never, {} as never, {} as never, {} as never, {} as never,
			{ getUserPolicies, getUserRoles } as never,
			{ logger: new Logger('api-test') } as never, {} as never,
		);
		try {
			// Exercise the permission gate directly, independently of HTTP logging.
			await expect((service as any).call(
				{ name: 'notes/search', meta: { requiredRolePolicy: 'canSearchNotes' }, params: {}, exec },
				null, null, {}, null, { method: 'POST', ip: '127.0.0.1', headers: {} },
			)).rejects.toMatchObject({ code: 'ROLE_PERMISSION_DENIED' });
			expect(getUserPolicies).toHaveBeenCalledExactlyOnceWith(null, []);
			expect(getUserRoles).not.toHaveBeenCalled();
			expect(exec).not.toHaveBeenCalled();
		} finally {
			service.dispose();
		}
	});
});
