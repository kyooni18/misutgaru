/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type {
	ChannelFavoritesRepository,
	ChannelFollowingsRepository, ChannelMutingRepository,
	ChannelsRepository,
	DriveFilesRepository,
	MiDriveFile,
	MiNote,
	NotesRepository,
} from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiUser } from '@/models/User.js';
import type { MiChannel } from '@/models/Channel.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class ChannelEntityService {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.channelFollowingsRepository)
		private channelFollowingsRepository: ChannelFollowingsRepository,
		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,
		@Inject(DI.channelMutingRepository)
		private channelMutingRepository: ChannelMutingRepository,
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
		private noteEntityService: NoteEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(
		src: MiChannel['id'] | MiChannel,
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
		opts?: {
			bannerFiles?: Map<MiDriveFile['id'], MiDriveFile>;
			followings?: Set<MiChannel['id']>;
			favorites?: Set<MiChannel['id']>;
			muting?: Set<MiChannel['id']>;
			pinnedNotes?: Map<MiNote['id'], MiNote>;
		},
	): Promise<Packed<'Channel'>> {
		const channel = typeof src === 'object' ? src : await this.channelsRepository.findOneByOrFail({ id: src });

		let bannerFile: MiDriveFile | null = null;
		if (channel.bannerId) {
			bannerFile = opts?.bannerFiles?.get(channel.bannerId)
				?? await this.driveFilesRepository.findOneByOrFail({ id: channel.bannerId });
		}

		let isFollowing = false;
		let isFavorited = false;
		let isMuting = false;
		if (me) {
			isFollowing = opts?.followings?.has(channel.id) ?? await this.channelFollowingsRepository.exists({
				where: {
					followerId: me.id,
					followeeId: channel.id,
				},
			});

			isFavorited = opts?.favorites?.has(channel.id) ?? await this.channelFavoritesRepository.exists({
				where: {
					userId: me.id,
					channelId: channel.id,
				},
			});

			isMuting = opts?.muting?.has(channel.id) ?? await this.channelMutingRepository.exists({
				where: {
					userId: me.id,
					channelId: channel.id,
				},
			});
		}

		const pinnedNotes = Array.of<MiNote>();
		if (detailed && channel.pinnedNoteIds.length > 0) {
			pinnedNotes.push(
				...(
					opts?.pinnedNotes
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						? channel.pinnedNoteIds.map(it => opts.pinnedNotes!.get(it)).filter(it => it != null)
						: await this.notesRepository.findBy({ id: In(channel.pinnedNoteIds) })
				),
			);
		}

		return {
			id: channel.id,
			createdAt: this.idService.parse(channel.id).date.toISOString(),
			lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerUrl: bannerFile ? this.driveFileEntityService.getPublicUrl(bannerFile) : null,
			bannerId: channel.bannerId,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: channel.usersCount,
			notesCount: channel.notesCount,
			isSensitive: channel.isSensitive,
			allowRenoteToExternal: channel.allowRenoteToExternal,

			...(me ? {
				isFollowing,
				isFavorited,
				isMuting,
				hasUnreadNote: false, // 後方互換性のため
			} : {}),

			...(detailed ? {
				pinnedNotes: await this.noteEntityService.packMany(pinnedNotes, me).then(packed => {
					const position = new Map<MiNote['id'], number>();
					for (let index = 0; index < channel.pinnedNoteIds.length; index++) position.set(channel.pinnedNoteIds[index], index);
					return packed.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
				}),
			} : {}),
		};
	}

	@bindThis
	public async packMany(
		src: MiChannel['id'][] | MiChannel[],
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
		options?: { preserveOrder?: boolean },
	): Promise<Packed<'Channel'>[]> {
		if (src.length === 0) return [];

		// IDのみの要素がある場合、DBからオブジェクトを取得して補う。
		const objectChannels = src.filter((it): it is MiChannel => typeof it === 'object');
		const unresolvedIds = [...new Set(src.filter((it): it is MiChannel['id'] => typeof it !== 'object'))];
		const fetchedChannels = unresolvedIds.length > 0
			? await this.channelsRepository.find({ where: { id: In(unresolvedIds) } })
			: [];
		let channels = [...objectChannels, ...fetchedChannels];
		if (options?.preserveOrder) {
			const byId = new Map<MiChannel['id'], MiChannel>();
			for (const channel of channels) if (!byId.has(channel.id)) byId.set(channel.id, channel);
			channels = src.map(item => typeof item === 'object' ? item : byId.get(item)).filter((item): item is MiChannel => item != null);
		} else {
			channels.sort((a, b) => a.id.localeCompare(b.id));
		}

		const bannerIds = [...new Set(channels.map(channel => channel.bannerId).filter((id): id is string => id != null))];
		const bannerFiles = bannerIds.length > 0
			? await this.driveFilesRepository.findBy({ id: In(bannerIds) }).then((rows: MiDriveFile[]) => new Map(rows.map((row: MiDriveFile) => [row.id, row])))
			: new Map<MiDriveFile['id'], MiDriveFile>();

		const followings = me
			? await this.channelFollowingsRepository
				.findBy({
					followerId: me.id,
					followeeId: In(channels.map(it => it.id)),
				})
				.then(it => new Set(it.map(it => it.followeeId)))
			: new Set<MiChannel['id']>();

		const favorites = me
			? await this.channelFavoritesRepository
				.findBy({
					userId: me.id,
					channelId: In(channels.map(it => it.id)),
				})
				.then(it => new Set(it.map(it => it.channelId)))
			: new Set<MiChannel['id']>();

		const muting = me
			? await this.channelMutingRepository
				.findBy({
					userId: me.id,
					channelId: In(channels.map(it => it.id)),
				})
				.then(it => new Set(it.map(it => it.channelId)))
			: new Set<MiChannel['id']>();

		const pinnedNoteIds = detailed ? [...new Set(channels.flatMap(channel => channel.pinnedNoteIds))] : [];
		const pinnedNotes = pinnedNoteIds.length > 0
			? await this.notesRepository.find({ where: { id: In(pinnedNoteIds) } }).then((rows: MiNote[]) => new Map(rows.map((row: MiNote) => [row.id, row])))
			: new Map<MiNote['id'], MiNote>();

		return Promise.all(channels.map(it => this.pack(it, me, detailed, {
			bannerFiles,
			followings,
			favorites,
			muting,
			pinnedNotes,
		})));
	}
}

