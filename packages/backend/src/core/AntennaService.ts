/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { In } from 'typeorm';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { parseRedisStreamEvent } from '@/misc/redis-event.js';
import { DI } from '@/di-symbols.js';
import * as Acct from '@/misc/acct.js';
import type { Packed } from '@/misc/json-schema.js';
import type { AntennasRepository, MiFollowing, UserListMembershipsRepository } from '@/models/_.js';
import type { MiAntenna } from '@/models/Antenna.js';
import type { MiNote } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';
import { CacheService } from './CacheService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

type UserFollowings = Record<string, Pick<MiFollowing, 'withReplies'> | undefined>;

type CompiledAntenna = {
	users: Set<string> | null;
	keywords: string[][];
	excludeKeywords: string[][];
};

type AntennaMatchContext = {
	account: string | null;
	text: string | null;
	lowerText: string | null;
	followings: Map<MiUser['id'], Promise<UserFollowings>> | null;
	listMemberships: Map<string, Promise<boolean>> | null;
};

@Injectable()
export class AntennaService implements OnApplicationShutdown {
	private antennasFetched: boolean;
	private antennas: MiAntenna[];
	private antennasFetch: Promise<MiAntenna[]> | null = null;
	private compiledAntennas = new WeakMap<MiAntenna, CompiledAntenna>();

	constructor(
		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		private cacheService: CacheService,
		private utilityService: UtilityService,
		private globalEventService: GlobalEventService,
		private fanoutTimelineService: FanoutTimelineService,
	) {
		this.antennasFetched = false;
		this.antennas = [];

		this.redisForSub.on('message', this.onRedisMessage);
	}

	@bindThis
	private async onRedisMessage(_: string, data: string): Promise<void> {
		const obj = parseRedisStreamEvent(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as GlobalEvents['internal']['payload'];
			switch (type) {
				case 'antennaCreated':
					this.antennas.push({ // TODO: このあたりのデシリアライズ処理は各modelファイル内に関数としてexportしたい
						...body,
						lastUsedAt: new Date(body.lastUsedAt),
						user: null, // joinなカラムは通常取ってこないので
						userList: null, // joinなカラムは通常取ってこないので
					});
					break;
				case 'antennaUpdated': {
					const idx = this.antennas.findIndex(a => a.id === body.id);
					if (idx >= 0) {
						this.antennas[idx] = { // TODO: このあたりのデシリアライズ処理は各modelファイル内に関数としてexportしたい
							...body,
							lastUsedAt: new Date(body.lastUsedAt),
							user: null, // joinなカラムは通常取ってこないので
							userList: null, // joinなカラムは通常取ってこないので
						};
					} else {
						// サーバ起動時にactiveじゃなかった場合、リストに持っていないので追加する必要あり
						this.antennas.push({ // TODO: このあたりのデシリアライズ処理は各modelファイル内に関数としてexportしたい
							...body,
							lastUsedAt: new Date(body.lastUsedAt),
							user: null, // joinなカラムは通常取ってこないので
							userList: null, // joinなカラムは通常取ってこないので
						});
					}
				}
					break;
				case 'antennaDeleted':
					this.antennas = this.antennas.filter(a => a.id !== body.id);
					break;
				default:
					break;
			}
		}
	}

	@bindThis
	public async addNoteToAntennas(note: MiNote, noteUser: { id: MiUser['id']; username: string; host: string | null; isBot: boolean; }): Promise<void> {
		const antennas = await this.getAntennas();
		if (antennas.length === 0) return;

		const context = this.createMatchContext(note);
		const matches = await Promise.all(antennas.map(antenna => this.checkHitAntennaWithContext(antenna, note, noteUser, context)));

		const redisPipeline = this.redisForTimelines.pipeline();

		for (let i = 0; i < antennas.length; i++) {
			if (!matches[i]) continue;
			const antenna = antennas[i];
			this.fanoutTimelineService.push(`antennaTimeline:${antenna.id}`, note.id, 200, redisPipeline);
			this.globalEventService.publishAntennaStream(antenna.id, 'note', note);
		}

		redisPipeline.exec();
	}

	// NOTE: フォローしているユーザーのノート、リストのユーザーのノート、グループのユーザーのノート指定はパフォーマンス上の理由で無効になっている

	@bindThis
	public async checkHitAntenna(antenna: MiAntenna, note: (MiNote | Packed<'Note'>), noteUser: { id: MiUser['id']; username: string; host: string | null; isBot: boolean; }): Promise<boolean> {
		return this.checkHitAntennaWithContext(antenna, note, noteUser, this.createMatchContext(note));
	}

	private createMatchContext(note: MiNote | Packed<'Note'>): AntennaMatchContext {
		return {
			account: null,
			text: note.text == null && note.cw == null ? null : `${note.text ?? ''}\n${note.cw ?? ''}`,
			lowerText: null,
			followings: null,
			listMemberships: null,
		};
	}

	private compileAntenna(antenna: MiAntenna): CompiledAntenna {
		const cached = this.compiledAntennas.get(antenna);
		if (cached) return cached;

		const normalizeKeywords = (keywords: string[][]): string[][] => keywords
			.map(xs => xs.filter(x => x !== ''))
			.filter(xs => xs.length > 0)
			.map(xs => antenna.caseSensitive ? xs : xs.map(keyword => keyword.toLowerCase()));

		const compiled: CompiledAntenna = {
			users: antenna.src === 'users' || antenna.src === 'users_blacklist'
				? new Set(antenna.users.map(x => {
					const { username, host } = Acct.parse(x);
					return this.utilityService.getFullApAccount(username, host).toLowerCase();
				}))
				: null,
			keywords: normalizeKeywords(antenna.keywords),
			excludeKeywords: normalizeKeywords(antenna.excludeKeywords),
		};
		this.compiledAntennas.set(antenna, compiled);
		return compiled;
	}

	private getNoteAccount(context: AntennaMatchContext, noteUser: { username: string; host: string | null }): string {
		if (context.account == null) {
			context.account = this.utilityService.getFullApAccount(noteUser.username, noteUser.host).toLowerCase();
		}
		return context.account;
	}

	private getMatchText(context: AntennaMatchContext, caseSensitive: boolean): string | null {
		if (context.text == null || caseSensitive) return context.text;
		if (context.lowerText == null) context.lowerText = context.text.toLowerCase();
		return context.lowerText;
	}

	private async checkHitAntennaWithContext(antenna: MiAntenna, note: (MiNote | Packed<'Note'>), noteUser: { id: MiUser['id']; username: string; host: string | null; isBot: boolean; }, context: AntennaMatchContext): Promise<boolean> {
		if (antenna.excludeNotesInSensitiveChannel && note.channel?.isSensitive) return false;

		if (antenna.excludeBots && noteUser.isBot) return false;

		if (antenna.localOnly && noteUser.host != null) return false;

		if (!antenna.withReplies && note.replyId != null) return false;

		if (note.visibility === 'specified') {
			if (note.userId !== antenna.userId) {
				if (note.visibleUserIds == null) return false;
				if (!note.visibleUserIds.includes(antenna.userId)) return false;
			}
		}

		if (note.visibility === 'followers') {
			context.followings ??= new Map();
			let followings = context.followings.get(antenna.userId);
			if (followings == null) {
				followings = this.cacheService.userFollowingsCache.fetch(antenna.userId);
				context.followings.set(antenna.userId, followings);
			}
			const isFollowing = Object.hasOwn(await followings, note.userId);
			if (!isFollowing && antenna.userId !== note.userId) return false;
		}

		const compiled = this.compileAntenna(antenna);

		if (antenna.src === 'home') {
			// TODO
		} else if (antenna.src === 'list') {
			if (antenna.userListId == null) return false;
			context.listMemberships ??= new Map();
			let membership = context.listMemberships.get(antenna.userListId);
			if (membership == null) {
				const membershipFetch: Promise<boolean> = this.userListMembershipsRepository.exists({
					where: {
						userListId: antenna.userListId,
						userId: note.userId,
					},
				});
				context.listMemberships.set(antenna.userListId, membershipFetch);
				membership = membershipFetch;
			}
			const exists = await membership;
			if (!exists) return false;
		} else if (antenna.src === 'users') {
			if (!compiled.users!.has(this.getNoteAccount(context, noteUser))) return false;
		} else if (antenna.src === 'users_blacklist') {
			if (compiled.users!.has(this.getNoteAccount(context, noteUser))) return false;
		}

		if (compiled.keywords.length > 0) {
			const text = this.getMatchText(context, antenna.caseSensitive);
			if (text == null) return false;

			const matched = compiled.keywords.some(and =>
				and.every(keyword =>
					text.includes(keyword),
				));

			if (!matched) return false;
		}

		if (compiled.excludeKeywords.length > 0) {
			const text = this.getMatchText(context, antenna.caseSensitive);
			if (text == null) return false;

			const matched = compiled.excludeKeywords.some(and =>
				and.every(keyword =>
					text.includes(keyword),
				));

			if (matched) return false;
		}

		if (antenna.withFile) {
			if (note.fileIds && note.fileIds.length === 0) return false;
		}

		// TODO: eval expression

		return true;
	}

	@bindThis
	public async getAntennas(): Promise<MiAntenna[]> {
		if (!this.antennasFetched) {
			if (this.antennasFetch == null) {
				const fetch = this.antennasRepository.findBy({
					isActive: true,
				}).then((antennas: MiAntenna[]) => {
					this.antennas = antennas;
					this.antennasFetched = true;
					return antennas;
				}).finally(() => {
					this.antennasFetch = null;
				});
				this.antennasFetch = fetch;
				return fetch;
			}
			return this.antennasFetch;
		}

		return this.antennas;
	}

	@bindThis
	public async onMoveAccount(src: MiUser, dst: MiUser): Promise<void> {
		// There is a possibility for users to add the srcUser to their antennas, but it's low, so we don't check it.

		// Get MiAntenna[] from cache and filter to select antennas with the src user is in the users list
		const srcUserAcct = this.utilityService.getFullApAccount(src.username, src.host).toLowerCase();
		const antennasToMigrate = (await this.getAntennas()).filter((antenna: MiAntenna) => {
			return antenna.users.some((user: string) => {
				const { username, host } = Acct.parse(user);
				return this.utilityService.getFullApAccount(username, host).toLowerCase() === srcUserAcct;
			});
		});

		if (antennasToMigrate.length === 0) return;

		const antennaIds = antennasToMigrate.map(x => x.id);

		// Update the antennas by appending dst users acct to the users list
		const dstUserAcct = '@' + Acct.toString({ username: dst.username, host: dst.host });

		await this.antennasRepository.createQueryBuilder('antenna')
			.update()
			.set({
				users: () => 'array_append(antenna.users, :dstUserAcct)',
			})
			.where('antenna.id IN (:...antennaIds)', { antennaIds })
			.setParameters({ dstUserAcct })
			.execute();

		// announce update to event
		for (const newAntenna of await this.antennasRepository.findBy({ id: In(antennaIds) })) {
			this.globalEventService.publishInternalEvent('antennaUpdated', newAntenna);
		}
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onRedisMessage);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
