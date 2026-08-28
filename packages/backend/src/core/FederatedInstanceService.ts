/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { InstancesRepository } from '@/models/_.js';
import type { MiInstance } from '@/models/Instance.js';
import { MemoryKVCache, RedisKVCache } from '@/misc/cache.js';
import { CacheInvalidationService } from '@/core/CacheInvalidationService.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class FederatedInstanceService implements OnApplicationShutdown {
	public federatedInstanceCache: RedisKVCache<MiInstance | null>;
	private pendingFetchOrRegister = new Map<string, Promise<MiInstance>>();

	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private utilityService: UtilityService,
		private idService: IdService,
		private cacheInvalidationService: CacheInvalidationService,
	) {
		this.federatedInstanceCache = new RedisKVCache<MiInstance | null>(this.redisClient, 'federatedInstance', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: (key) => this.instancesRepository.findOneBy({ host: key }),
			toRedisConverter: (value) => JSON.stringify(value),
			fromRedisConverter: (value) => {
				const parsed = JSON.parse(value);
				if (parsed == null) return null;
				return {
					...parsed,
					firstRetrievedAt: new Date(parsed.firstRetrievedAt),
					latestRequestReceivedAt: parsed.latestRequestReceivedAt ? new Date(parsed.latestRequestReceivedAt) : null,
					infoUpdatedAt: parsed.infoUpdatedAt ? new Date(parsed.infoUpdatedAt) : null,
					notRespondingSince: parsed.notRespondingSince ? new Date(parsed.notRespondingSince) : null,
				};
			},
			invalidationBus: this.cacheInvalidationService,
		});
	}

	@bindThis
	public fetchOrRegister(host: string): Promise<MiInstance> {
		host = this.utilityService.toPuny(host);
		const pending = this.pendingFetchOrRegister.get(host);
		if (pending) return pending;

		const operation = (async () => {
			const cached = await this.federatedInstanceCache.get(host);
			if (cached) return cached;

			// A cached null intentionally falls through to the database: another
			// worker may have registered the instance since the negative cache entry.
			const index = await this.instancesRepository.findOneBy({ host });
			if (index != null) {
				void this.federatedInstanceCache.set(host, index);
				return index;
			}

			const instance = await this.instancesRepository.insertOne({
				id: this.idService.gen(),
				host,
				firstRetrievedAt: new Date(),
			});

			void this.federatedInstanceCache.set(host, instance);
			return instance;
		})().finally(() => {
			if (this.pendingFetchOrRegister.get(host) === operation) this.pendingFetchOrRegister.delete(host);
		});

		this.pendingFetchOrRegister.set(host, operation);
		return operation;
	}

	@bindThis
	public async fetch(host: string): Promise<MiInstance | null> {
		host = this.utilityService.toPuny(host);
		return this.federatedInstanceCache.fetch(host);
	}

	@bindThis
	public async update(id: MiInstance['id'], data: Partial<MiInstance>): Promise<void> {
		const result = await this.instancesRepository.createQueryBuilder().update()
			.set(data)
			.where('id = :id', { id })
			.returning('*')
			.execute()
			.then((response) => {
				return response.raw[0];
			});

		this.federatedInstanceCache.set(result.host, result);
	}

	@bindThis
	public dispose(): void {
		this.pendingFetchOrRegister.clear();
		this.federatedInstanceCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
