/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiUser } from '@/models/User.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { IdService } from '@/core/IdService.js';
import { MiHashtag } from '@/models/Hashtag.js';
import type { HashtagsRepository, MiMeta } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { FeaturedService } from '@/core/FeaturedService.js';
import { UtilityService } from '@/core/UtilityService.js';
import Logger from '../logger.js';

const logger = new Logger('hashtag/create');

type AttachedOrMentioned = 'attached' | 'mentioned';
type UpdatingHashtagColumn = {
	totalUserIds: keyof MiHashtag & `${AttachedOrMentioned}UserIds`,
	totalUsersCount: keyof MiHashtag & `${AttachedOrMentioned}UsersCount`,
	localUserIds: keyof MiHashtag & `${AttachedOrMentioned}LocalUserIds`,
	localUsersCount: keyof MiHashtag & `${AttachedOrMentioned}LocalUsersCount`,
	remoteUserIds: keyof MiHashtag & `${AttachedOrMentioned}RemoteUserIds`,
	remoteUsersCount: keyof MiHashtag & `${AttachedOrMentioned}RemoteUsersCount`,
};

@Injectable()
export class HashtagService {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.redis)
		private redisClient: Redis.Redis, // TODO: 専用のRedisサーバーを設定できるようにする

		@Inject(DI.hashtagsRepository)
		private hashtagsRepository: HashtagsRepository,

		private userEntityService: UserEntityService,
		private featuredService: FeaturedService,
		private idService: IdService,
		private utilityService: UtilityService,
	) {
	}

	@bindThis
	public async updateHashtags(user: { id: MiUser['id']; host: MiUser['host']; }, tags: string[]) {
		if (tags.length === 0) return;
		const normalizedTags = tags.map(tag => normalizeForSearch(tag));
		void this.updateHashtagsRankingMany(normalizedTags, user.id);
		await this.#incrementHashTags(user, [...new Set(normalizedTags)], this.getUpdatingHashtagColumns(false));
	}

	@bindThis
	public async updateUsertags(user: MiUser, tags: string[]) {
		const inputTags = new Set(tags);
		const removedTags = user.tags.filter(tag => !inputTags.has(tag));
		const normalizedAddedTags = tags.map(tag => normalizeForSearch(tag));
		const normalizedRemovedTags = removedTags.map(tag => normalizeForSearch(tag));
		const columns = this.getUpdatingHashtagColumns(true);
		void this.updateHashtagsRankingMany([...normalizedAddedTags, ...normalizedRemovedTags], user.id);
		// Preserve the old add-then-remove ordering for case-variant tags that
		// normalize to the same hashtag, while collapsing N queries to at most two.
		await this.#incrementHashTags(user, [...new Set(normalizedAddedTags)], columns);
		await this.#decrementHashTags(user, [...new Set(normalizedRemovedTags)], columns);
	}

	@bindThis
	public async updateHashtag(user: { id: MiUser['id']; host: MiUser['host']; }, tag: string, isUserAttached = false, inc = true) {
		tag = normalizeForSearch(tag);

		void this.updateHashtagsRankingMany([tag], user.id);
		await (inc
			? this.#incrementHashTags(user, [tag], this.getUpdatingHashtagColumns(isUserAttached))
			: this.#decrementHashTags(user, [tag], this.getUpdatingHashtagColumns(isUserAttached)));
	}

	private getUpdatingHashtagColumns(isUserAttached: boolean): UpdatingHashtagColumn {
		return isUserAttached ? {
			totalUserIds: 'attachedUserIds',
			totalUsersCount: 'attachedUsersCount',
			localUserIds: 'attachedLocalUserIds',
			localUsersCount: 'attachedLocalUsersCount',
			remoteUserIds: 'attachedRemoteUserIds',
			remoteUsersCount: 'attachedRemoteUsersCount',
		} : {
			totalUserIds: 'mentionedUserIds',
			totalUsersCount: 'mentionedUsersCount',
			localUserIds: 'mentionedLocalUserIds',
			localUsersCount: 'mentionedLocalUsersCount',
			remoteUserIds: 'mentionedRemoteUserIds',
			remoteUsersCount: 'mentionedRemoteUsersCount',
		};
	}

	async #incrementHashTags(
		user: { id: MiUser['id']; host: MiUser['host']; },
		tags: string[],
		columns: UpdatingHashtagColumn,
	) {
		if (tags.length === 0) return;
		const isLocal = this.userEntityService.isLocalUser(user);
		const { totalUserIds, totalUsersCount } = columns;
		const localOrRemoteUserIds = isLocal ? columns.localUserIds : columns.remoteUserIds;
		const localOrRemoteUserCount = isLocal ? columns.localUsersCount : columns.remoteUsersCount;

		const runner = this.db.createQueryRunner('master');
		try {
			await runner.query(
				`INSERT into "hashtag"("id", "name", "${totalUserIds}", "${totalUsersCount}", "${localOrRemoteUserIds}",
				                       "${localOrRemoteUserCount}")
				 SELECT input.id, input.name, ARRAY [$3::varchar], 1, ARRAY [$3::varchar], 1
				 FROM unnest($1::varchar[], $2::varchar[]) AS input(id, name)
				 ON CONFLICT ("name")
					 DO UPDATE SET "${totalUserIds}"           = ${appendUserIdIfNotExists(totalUserIds)},
					               "${totalUsersCount}"        = ${incrementCountIfNotExists(totalUserIds, totalUsersCount)},
					               "${localOrRemoteUserIds}"   = ${appendUserIdIfNotExists(localOrRemoteUserIds)},
					               "${localOrRemoteUserCount}" = ${incrementCountIfNotExists(localOrRemoteUserIds, localOrRemoteUserCount)}`,
				[tags.map(() => this.idService.gen()), tags, user.id],
			);
		} finally {
			await runner.release();
		}

		function appendUserIdIfNotExists(userIds: keyof MiHashtag & `${string}UserIds`): string {
			return `CASE WHEN NOT ("hashtag"."${userIds}" @> ARRAY[$3 ::varchar]) THEN array_append("hashtag"."${userIds}", $3) ELSE "hashtag"."${userIds}" END`;
		}

		function incrementCountIfNotExists(userIds: keyof MiHashtag & `${string}UserIds`, userCount: keyof MiHashtag & `${string}UsersCount`): string {
			return `CASE WHEN NOT ("hashtag"."${userIds}" @> ARRAY[$3 ::varchar]) THEN "hashtag"."${userCount}" + 1 ELSE "hashtag"."${userCount}" END`;
		}
	}

	async #decrementHashTags(
		user: { id: MiUser['id']; host: MiUser['host']; },
		tags: string[],
		columns: UpdatingHashtagColumn,
	) {
		if (tags.length === 0) return;
		const isLocal = this.userEntityService.isLocalUser(user);
		const { totalUserIds, totalUsersCount } = columns;
		const localOrRemoteUserIds = isLocal ? columns.localUserIds : columns.remoteUserIds;
		const localOrRemoteUserCount = isLocal ? columns.localUsersCount : columns.remoteUsersCount;

		const runner = this.db.createQueryRunner('master');
		try {
			await runner.query(
				`UPDATE "hashtag"
				 SET "${totalUserIds}"           = array_remove("${totalUserIds}", $2),
				     "${totalUsersCount}"        = ${decrementIfExists(totalUserIds, totalUsersCount)},
				     "${localOrRemoteUserIds}"   = array_remove("${localOrRemoteUserIds}", $2),
				     "${localOrRemoteUserCount}" = ${decrementIfExists(localOrRemoteUserIds, localOrRemoteUserCount)}
				 WHERE "name" = ANY($1::varchar[])`,
				[tags, user.id],
			);
		} finally {
			await runner.release();
		}

		function decrementIfExists(userIds: keyof MiHashtag & `${string}UserIds`, userCount: keyof MiHashtag & `${string}UsersCount`): string {
			return `CASE WHEN ("${userIds}" @> ARRAY[$2]) THEN "${userCount}" - 1 ELSE "${userCount}" END`;
		}
	}

	@bindThis
	public async updateHashtagsRanking(hashtag: string, userId: MiUser['id']): Promise<void> {
		await this.updateHashtagsRankingMany([normalizeForSearch(hashtag)], userId);
	}

	private async updateHashtagsRankingMany(hashtags: string[], userId: MiUser['id']): Promise<void> {
		if (hashtags.length === 0) return;
		const hiddenTags = new Set(this.meta.hiddenTags.map(tag => normalizeForSearch(tag)));
		const candidates = hashtags.filter(hashtag => !hiddenTags.has(hashtag) && !this.utilityService.isKeyWordIncluded(hashtag, this.meta.sensitiveWords));
		if (candidates.length === 0) return;

		// YYYYMMDDHHmm (10分間隔)
		const now = new Date();
		now.setMinutes(Math.floor(now.getMinutes() / 10) * 10, 0, 0);
		const window = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}`;

		const membershipPipeline = this.redisClient.pipeline();
		for (const hashtag of candidates) membershipPipeline.sismember(`hashtagUsers:${hashtag}`, userId);
		const membershipResults = await membershipPipeline.exec();
		if (membershipResults == null) return;

		const newHashtags: string[] = [];
		for (let i = 0; i < candidates.length; i++) {
			if (membershipResults[i][1] !== 1) newHashtags.push(candidates[i]);
		}
		if (newHashtags.length === 0) return;

		const redisPipeline = this.redisClient.pipeline();
		for (const hashtag of newHashtags) {
			// チャート用
			redisPipeline.pfadd(`hashtagUsers:${hashtag}:${window}`, userId);
			redisPipeline.expire(`hashtagUsers:${hashtag}:${window}`, 60 * 60 * 24 * 3, 'NX');

			// ユニークカウント用
			redisPipeline.sadd(`hashtagUsers:${hashtag}`, userId);
			redisPipeline.expire(`hashtagUsers:${hashtag}`, 60 * 60, 'NX');
		}

		await Promise.all([
			this.featuredService.updateHashtagsRankingMany(newHashtags, 1),
			redisPipeline.exec(),
		]);
	}

	@bindThis
	public async getChart(hashtag: string, range: number): Promise<number[]> {
		const now = new Date();
		now.setMinutes(Math.floor(now.getMinutes() / 10) * 10, 0, 0);

		const redisPipeline = this.redisClient.pipeline();

		for (let i = 0; i < range; i++) {
			const window = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}`;
			redisPipeline.pfcount(`hashtagUsers:${hashtag}:${window}`);
			now.setMinutes(now.getMinutes() - (i * 10), 0, 0);
		}

		const result = await redisPipeline.exec();

		if (result == null) return [];

		return result.map(x => x[1]) as number[];
	}

	@bindThis
	public async getCharts(hashtags: string[], range: number): Promise<Record<string, number[]>> {
		const now = new Date();
		now.setMinutes(Math.floor(now.getMinutes() / 10) * 10, 0, 0);

		const redisPipeline = this.redisClient.pipeline();

		for (let i = 0; i < range; i++) {
			const window = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}`;
			for (const hashtag of hashtags) {
				redisPipeline.pfcount(`hashtagUsers:${hashtag}:${window}`);
			}
			now.setMinutes(now.getMinutes() - (i * 10), 0, 0);
		}

		const result = await redisPipeline.exec();

		if (result == null) return {};

		// key is hashtag
		const charts = {} as Record<string, number[]>;
		for (const hashtag of hashtags) {
			charts[hashtag] = [];
		}

		for (let i = 0; i < range; i++) {
			for (let j = 0; j < hashtags.length; j++) {
				charts[hashtags[j]].push(result[(i * hashtags.length) + j][1] as number);
			}
		}

		return charts;
	}
}
