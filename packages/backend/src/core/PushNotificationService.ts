/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import push from 'web-push';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { Packed } from '@/misc/json-schema.js';
import { getNoteSummary } from '@/misc/get-note-summary.js';
import type { MiMeta, MiSwSubscription, SwSubscriptionsRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { RedisKVCache } from '@/misc/cache.js';
import { CacheInvalidationService } from '@/core/CacheInvalidationService.js';
import { LoggerService } from '@/core/LoggerService.js';

// Defined also packages/sw/types.ts#L13
type PushNotificationsTypes = {
	'notification': Packed<'Notification'>;
	'unreadAntennaNote': {
		antenna: { id: string, name: string };
		note: Packed<'Note'>;
	};
	'readAllNotifications': undefined;
	newChatMessage: Packed<'ChatMessage'>;
};

function compactPushUser(user: Packed<'UserLite'>): Packed<'UserLite'> {
	return {
		id: user.id,
		name: user.name,
		username: user.username,
		host: user.host,
		avatarUrl: user.avatarUrl,
	} as Packed<'UserLite'>;
}

// Reduce length because push message servers have character limits
export function truncateBody<T extends keyof PushNotificationsTypes>(type: T, body: PushNotificationsTypes[T]): PushNotificationsTypes[T] {
	if (typeof body !== 'object') return body;

	if (type === 'newChatMessage' && 'fromUser' in body && body.fromUser != null) {
		const chatBody = body as unknown as Packed<'ChatMessage'>;
		return {
			id: chatBody.id,
			createdAt: chatBody.createdAt,
			fromUserId: chatBody.fromUserId,
			fromUser: {
				id: chatBody.fromUser.id,
				name: chatBody.fromUser.name,
				username: chatBody.fromUser.username,
				host: chatBody.fromUser.host,
				avatarUrl: chatBody.fromUser.avatarUrl,
			} as Packed<'UserLite'>,
			...(chatBody.toUserId != null ? { toUserId: chatBody.toUserId } : {}),
			...(chatBody.toRoomId != null ? {
				toRoomId: chatBody.toRoomId,
				toRoom: chatBody.toRoom ? {
					id: chatBody.toRoom.id,
					name: chatBody.toRoom.name,
				} as Packed<'ChatRoom'> : undefined,
			} : {}),
			text: typeof chatBody.text === 'string' ? chatBody.text.slice(0, 1024) : chatBody.text,
		} as unknown as PushNotificationsTypes[T];
	}

	const compactedBody = { ...body } as Record<string, unknown>;
	if ('note' in body && body.note) {
		compactedBody.note = {
			// Keep only fields consumed by the service worker. Packed notes carry
			// reactions, files, and other large fields that can push an encrypted
			// Web Push payload over the provider limit.
			id: body.note.id,
			createdAt: body.note.createdAt,
			visibility: body.note.visibility,
			// textをgetNoteSummaryしたものに置き換える
			text: getNoteSummary(
				('type' in body && body.type === 'renote' && body.note.renote != null)
					? body.note.renote as Packed<'Note'>
					: body.note,
			).slice(0, 1024),
			...(type === 'notification' ? {} : { user: body.note.user }),
		} as Packed<'Note'>;
	}

	if (type === 'notification' && 'user' in body && body.user != null) {
		compactedBody.user = compactPushUser(body.user as Packed<'UserLite'>);
	}
	if ('header' in compactedBody && typeof compactedBody.header === 'string') {
		compactedBody.header = compactedBody.header.slice(0, 256);
	}
	if ('body' in compactedBody && typeof compactedBody.body === 'string') {
		compactedBody.body = compactedBody.body.slice(0, 1024);
	}
	if ('reaction' in compactedBody && typeof compactedBody.reaction === 'string') {
		compactedBody.reaction = compactedBody.reaction.slice(0, 128);
	}
	if ('icon' in compactedBody && typeof compactedBody.icon === 'string' && compactedBody.icon.length > 2048) {
		delete compactedBody.icon;
	}
	// The worker has no renderer for failed scheduled-note payloads; retaining
	// the full draft only wastes the very small encrypted push payload budget.
	delete compactedBody.noteDraft;
	if ('text' in compactedBody && typeof compactedBody.text === 'string') {
		// Chat messages can contain a long body as well; keep enough text for
		// a useful notification while staying below Web Push payload limits.
		compactedBody.text = compactedBody.text.slice(0, 1024);
	}

	return compactedBody as PushNotificationsTypes[T];
}

@Injectable()
export class PushNotificationService implements OnApplicationShutdown {
	private subscriptionsCache: RedisKVCache<MiSwSubscription[]>;
	private readonly logger: ReturnType<LoggerService['getLogger']>;
	private vapidKeyFingerprint: string | null = null;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.swSubscriptionsRepository)
		private swSubscriptionsRepository: SwSubscriptionsRepository,

		loggerService: LoggerService,
		private cacheInvalidationService: CacheInvalidationService,
	) {
		this.logger = loggerService.getLogger('push');
		this.subscriptionsCache = new RedisKVCache<MiSwSubscription[]>(this.redisClient, 'userSwSubscriptions', {
			lifetime: 1000 * 60 * 60 * 1, // 1h
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: (key) => this.swSubscriptionsRepository.findBy({ userId: key }),
			toRedisConverter: (value) => JSON.stringify(value),
			fromRedisConverter: (value) => JSON.parse(value),
			invalidationBus: this.cacheInvalidationService,
		});
	}

	@bindThis
	public async pushNotification<T extends keyof PushNotificationsTypes>(userId: string, type: T, body: PushNotificationsTypes[T]) {
		if (!this.meta.enableServiceWorker || this.meta.swPublicKey == null || this.meta.swPrivateKey == null) return;

		// Register the application contact and server-side key pair. Admins can
		// rotate these keys at runtime, so refresh the web-push configuration only
		// when the configured pair actually changed.
		const vapidKeyFingerprint = `${this.meta.swPublicKey}:${this.meta.swPrivateKey}`;
		if (this.vapidKeyFingerprint !== vapidKeyFingerprint) {
			try {
				push.setVapidDetails(this.config.url, this.meta.swPublicKey, this.meta.swPrivateKey);
				this.vapidKeyFingerprint = vapidKeyFingerprint;
			} catch (error: unknown) {
				this.logger.error({ message: 'Invalid VAPID configuration; push delivery skipped', error });
				return;
			}
		}

		let subscriptions: MiSwSubscription[];
		try {
			subscriptions = await this.subscriptionsCache.fetch(userId);
		} catch (error: unknown) {
			this.logger.error({ message: 'Could not load push subscriptions', error });
			return;
		}
		if (subscriptions.length === 0) return;

		let payload: string;
		try {
			payload = JSON.stringify({
				type,
				body: (type === 'notification' || type === 'unreadAntennaNote' || type === 'newChatMessage') ? truncateBody(type, body) : body,
				userId,
				dateTime: Date.now(),
			});
		} catch (error: unknown) {
			this.logger.error({
				message: 'Could not serialize push notification payload',
				error,
				attributes: { userId, type },
			});
			return;
		}
		let cacheInvalidated = false;

		await Promise.allSettled(subscriptions.map(async subscription => {
			if ([
				'readAllNotifications',
			].includes(type) && !subscription.sendReadMessage) return;

			const pushSubscription = {
				endpoint: subscription.endpoint,
				keys: {
					auth: subscription.auth,
					p256dh: subscription.publickey,
				},
			};

			try {
				await push.sendNotification(pushSubscription, payload, {
					proxy: this.config.proxy,
					// A delayed read-all event must not clear notifications created
					// after the user initiated the action.
					TTL: type === 'readAllNotifications' ? 60 : 60 * 60 * 24,
					urgency: type === 'readAllNotifications' ? 'low' : 'normal',
				});
			} catch (error: unknown) {
				const statusCode = this.getStatusCode(error);
				if (statusCode === 404 || statusCode === 410) {
					// Push services use 404/410 to indicate that the endpoint has
					// expired or was revoked. Remove it so future notifications do not
					// repeatedly fail and so all platforms converge on live endpoints.
					try {
						await this.swSubscriptionsRepository.delete({
							userId,
							endpoint: subscription.endpoint,
							auth: subscription.auth,
							publickey: subscription.publickey,
						});
						cacheInvalidated = true;
					} catch (cleanupError: unknown) {
						this.logger.warn('Could not remove expired push subscription', {
							userId,
							error: cleanupError,
						});
					}
					return;
				}

				this.logger.warn('Push notification delivery failed', {
					statusCode,
					userId,
					type,
					error,
				});
			}
		}));

		if (cacheInvalidated) this.refreshCache(userId);
	}

	private getStatusCode(error: unknown): number | undefined {
		if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
		const statusCode = error.statusCode;
		return typeof statusCode === 'number' ? statusCode : undefined;
	}

	@bindThis
	public refreshCache(userId: string): void {
		this.subscriptionsCache.refresh(userId);
	}

	@bindThis
	public dispose(): void {
		this.subscriptionsCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
