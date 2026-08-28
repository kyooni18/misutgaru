/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import type { CacheInvalidationBus } from '@/misc/cache.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

type InvalidationMessage = {
	v: 1;
	origin: string;
	cache: string;
	key: string | null;
};

@Injectable()
export class CacheInvalidationService implements CacheInvalidationBus, OnApplicationShutdown {
	private readonly origin = randomUUID();
	private readonly channel: string;
	private readonly listeners = new Map<string, Set<(key: string | null) => void>>();
	private readonly redisForInvalidationSub: Redis.Redis;
	private subscribeInFlight = false;
	private subscribed = false;
	private subscribeFailures = 0;
	private subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null;
	private disposed = false;

	constructor(
		@Inject(DI.config) config: Config,
		@Inject(DI.redisForPub) private readonly redisForPub: Redis.Redis,
		@Inject(DI.redisForSub) redisForSub: Redis.Redis,
	) {
		this.channel = `${config.host}:misutgaru:cache-invalidation:v1`;
		// Do not subscribe the shared Misskey stream subscriber to this channel.
		// Every service attached to that connection receives every subscribed
		// channel and many existing listeners intentionally assume the host stream
		// envelope. A duplicate connection isolates cache-control messages while
		// reusing the exact same Redis options/TLS/auth configuration.
		this.redisForInvalidationSub = redisForSub.duplicate();
		this.redisForInvalidationSub.on('message', this.onMessage);
		this.ensureSubscribed();
	}

	private ensureSubscribed(): void {
		if (this.disposed || this.subscribed || this.subscribeInFlight) return;
		this.subscribeInFlight = true;
		void this.redisForInvalidationSub.subscribe(this.channel).then(async () => {
			this.subscribeInFlight = false;
			this.subscribeFailures = 0;
			if (this.disposed) {
				await this.redisForInvalidationSub.unsubscribe(this.channel).catch(() => undefined);
				return;
			}
			this.subscribed = true;
			runtimeDiagnostics.increment('cache.invalidationSubscribeSuccess');
		}).catch((error: unknown) => {
			this.subscribeInFlight = false;
			if (this.disposed) return;
			this.subscribeFailures += 1;
			runtimeDiagnostics.increment('cache.invalidationSubscribeError');
			runtimeDiagnostics.trace('cache.invalidationSubscribeError', 0, {
				message: error instanceof Error ? error.message : String(error),
				attempt: this.subscribeFailures,
			});
			this.scheduleSubscribeRetry();
		});
	}

	private scheduleSubscribeRetry(): void {
		if (this.disposed || this.subscribeRetryTimer !== null) return;
		const delay = Math.min(15_000, 500 * (2 ** Math.min(this.subscribeFailures - 1, 5)));
		this.subscribeRetryTimer = setTimeout(() => {
			this.subscribeRetryTimer = null;
			this.ensureSubscribed();
		}, delay);
		this.subscribeRetryTimer.unref?.();
	}

	public register(cacheName: string, listener: (key: string | null) => void): () => void {
		let listeners = this.listeners.get(cacheName);
		if (!listeners) {
			listeners = new Set();
			this.listeners.set(cacheName, listeners);
		}
		listeners.add(listener);
		return () => {
			const current = this.listeners.get(cacheName);
			if (!current) return;
			current.delete(listener);
			if (current.size === 0) this.listeners.delete(cacheName);
		};
	}

	public async publish(cacheName: string, key: string | null): Promise<void> {
		if (this.disposed) return;
		const message: InvalidationMessage = {
			v: 1,
			origin: this.origin,
			cache: cacheName,
			key,
		};
		await this.redisForPub.publish(this.channel, JSON.stringify(message));
	}

	private readonly onMessage = (channel: string, raw: string): void => {
		if (channel !== this.channel || this.disposed) return;
		let message: InvalidationMessage;
		try {
			message = JSON.parse(raw) as InvalidationMessage;
		} catch {
			return;
		}
		if (message?.v !== 1 || message.origin === this.origin || typeof message.cache !== 'string') return;
		if (message.key !== null && typeof message.key !== 'string') return;
		runtimeDiagnostics.increment('cache.remoteInvalidation');
		const listeners = this.listeners.get(message.cache);
		if (!listeners) return;
		for (const listener of [...listeners]) listener(message.key);
	};

	public async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		if (this.subscribeRetryTimer !== null) {
			clearTimeout(this.subscribeRetryTimer);
			this.subscribeRetryTimer = null;
		}
		this.listeners.clear();
		this.redisForInvalidationSub.off('message', this.onMessage);
		if (this.subscribed) await this.redisForInvalidationSub.unsubscribe(this.channel).catch(() => undefined);
		this.redisForInvalidationSub.disconnect();
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.dispose();
	}
}
