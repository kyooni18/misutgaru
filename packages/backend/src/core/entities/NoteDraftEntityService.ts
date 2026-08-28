/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EntityNotFoundError, In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { Packed } from '@/misc/json-schema.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser, MiNote, MiNoteDraft } from '@/models/_.js';
import type { NoteDraftsRepository, ChannelsRepository, NotesRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { BatchLoader } from '@/misc/loader.js';
import { requestBatchContext } from '@/misc/request-batch-context.js';
import { IdService } from '@/core/IdService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';
import type { NoteEntityService } from './NoteEntityService.js';

@Injectable()
export class NoteDraftEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private idService: IdService;
	private noteEntityService: NoteEntityService;
	private noteDraftLoader = new BatchLoader<string, MiNoteDraft>(this.findNoteDraftsBatch, id => new EntityNotFoundError('NoteDraft', { id }), 'noteDraft.entity');
	private channelLoader = new BatchLoader<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>(this.findChannelsBatch, () => null, 'noteDraft.channel');
	private get noteDraftLoaderForRequest(): BatchLoader<string, MiNoteDraft> {
		return requestBatchContext.getOrCreate(
			'NoteDraftEntityService.noteDraftLoader',
			() => new BatchLoader<string, MiNoteDraft>(this.findNoteDraftsBatch, id => new EntityNotFoundError('NoteDraft', { id }), 'noteDraft.entity', true),
			this.noteDraftLoader,
		);
	}

	private get channelLoaderForRequest(): BatchLoader<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>> {
		return requestBatchContext.getOrCreate(
			'NoteDraftEntityService.channelLoader',
			() => new BatchLoader<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>(this.findChannelsBatch, () => null, 'noteDraft.channel', true),
			this.channelLoader,
		);
	}

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.noteDraftsRepository)
		private noteDraftsRepository: NoteDraftsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.idService = this.moduleRef.get('IdService');
		this.noteEntityService = this.moduleRef.get('NoteEntityService');
	}

	@bindThis
	public async packAttachedFiles(fileIds: MiNote['fileIds'], packedFiles: Map<MiNote['fileIds'][number], Packed<'DriveFile'> | null>): Promise<Packed<'DriveFile'>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(x => x != null);
	}

	@bindThis
	public async pack(
		src: MiNoteDraft['id'] | MiNoteDraft,
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
			withReactionAndUserPairCache?: boolean;
			_hint_?: {
				packedFiles: Map<MiNote['fileIds'][number], Packed<'DriveFile'> | null>;
				packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
				channels?: Map<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>;
				packedReplies?: Map<MiNote['id'], Packed<'Note'> | null>;
				packedRenotes?: Map<MiNote['id'], Packed<'Note'> | null>;
			};
		},
	): Promise<Packed<'NoteDraft'>> {
		const opts = Object.assign({
			detail: true,
		}, options);

		const noteDraft = typeof src === 'object' ? src : await this.noteDraftLoaderForRequest.load(src);

		const text = noteDraft.text;

		const channel = noteDraft.channelId
			? noteDraft.channel ?? (options?._hint_?.channels?.has(noteDraft.channelId)
				? options._hint_.channels.get(noteDraft.channelId) ?? null
				: await this.channelLoaderForRequest.load(noteDraft.channelId))
			: null;

		const packedFiles = options?._hint_?.packedFiles;
		const packedUsers = options?._hint_?.packedUsers;

		async function nullIfEntityNotFound<T>(promise: Promise<T>): Promise<T | null> {
			try {
				return await promise;
			} catch (err) {
				if (err instanceof EntityNotFoundError) {
					return null;
				}
				throw err;
			}
		}

		const packed: Packed<'NoteDraft'> = await awaitAll({
			id: noteDraft.id,
			createdAt: this.idService.parse(noteDraft.id).date.toISOString(),
			scheduledAt: noteDraft.scheduledAt?.getTime() ?? null,
			isActuallyScheduled: noteDraft.isActuallyScheduled,
			userId: noteDraft.userId,
			user: packedUsers?.get(noteDraft.userId) ?? this.userEntityService.pack(noteDraft.user ?? noteDraft.userId, me),
			text: text,
			cw: noteDraft.cw,
			visibility: noteDraft.visibility,
			localOnly: noteDraft.localOnly,
			reactionAcceptance: noteDraft.reactionAcceptance,
			visibleUserIds: noteDraft.visibleUserIds,
			hashtag: noteDraft.hashtag,
			fileIds: noteDraft.fileIds,
			files: packedFiles != null ? this.packAttachedFiles(noteDraft.fileIds, packedFiles) : this.driveFileEntityService.packManyByIds(noteDraft.fileIds),
			replyId: noteDraft.replyId,
			renoteId: noteDraft.renoteId,
			channelId: noteDraft.channelId,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
				color: channel.color,
				isSensitive: channel.isSensitive,
				allowRenoteToExternal: channel.allowRenoteToExternal,
				userId: channel.userId,
			} : undefined,
			poll: noteDraft.hasPoll ? {
				choices: noteDraft.pollChoices,
				multiple: noteDraft.pollMultiple,
				expiresAt: noteDraft.pollExpiresAt?.toISOString(),
				expiredAfter: noteDraft.pollExpiredAfter,
			} : null,

			...(opts.detail ? {
				reply: noteDraft.replyId
					? (options?._hint_?.packedReplies?.has(noteDraft.replyId)
						? options._hint_.packedReplies.get(noteDraft.replyId)
						: nullIfEntityNotFound(this.noteEntityService.pack(noteDraft.replyId, me, {
							detail: false,
							skipHide: opts.skipHide,
						})))
					: undefined,

				renote: noteDraft.renoteId
					? (options?._hint_?.packedRenotes?.has(noteDraft.renoteId)
						? options._hint_.packedRenotes.get(noteDraft.renoteId)
						: nullIfEntityNotFound(this.noteEntityService.pack(noteDraft.renoteId, me, {
							detail: true,
							skipHide: opts.skipHide,
						})))
					: undefined,
			} : {} ),
		});

		return packed;
	}

	@bindThis
	public async packMany(
		noteDrafts: MiNoteDraft[],
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
		},
	) {
		if (noteDrafts.length === 0) return [];

		// TODO: 本当は renote とか reply がないのに renoteId とか replyId があったらここで解決しておく
		const fileIds = noteDrafts.map(n => [n.fileIds, n.renote?.fileIds, n.reply?.fileIds]).flat(2).filter(x => x != null);
		const packedFiles = fileIds.length > 0 ? await this.driveFileEntityService.packManyByIdsMap(fileIds) : new Map();
		const users = [
			...noteDrafts.map(({ user, userId }) => user ?? userId),
		];
		const channelIds = [...new Set(noteDrafts.map(draft => draft.channelId).filter((id): id is string => id != null))];
		const replyIds = options?.detail === false ? [] : [...new Set(noteDrafts.map(draft => draft.replyId).filter((id): id is string => id != null))];
		const renoteIds = options?.detail === false ? [] : [...new Set(noteDrafts.map(draft => draft.renoteId).filter((id): id is string => id != null))];
		const referencedNoteIds = [...new Set([...replyIds, ...renoteIds])];
		const [packedUsers, channelRows, referencedNotes] = await Promise.all([
			this.userEntityService.packMany(users, me).then(users => new Map(users.map(u => [u.id, u]))),
			channelIds.length > 0 ? this.channelsRepository.findBy({ id: In(channelIds) }) : Promise.resolve([]),
			referencedNoteIds.length > 0 ? this.notesRepository.find({
				where: { id: In(referencedNoteIds) },
				relations: { user: true, reply: true, renote: true },
			}) : Promise.resolve([]),
		]);
		const channels = new Map<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>();
		for (const channel of channelRows) channels.set(channel.id, channel);
		for (const channelId of channelIds) if (!channels.has(channelId)) channels.set(channelId, null);

		const referencedNotesById = new Map<MiNote['id'], MiNote>((referencedNotes as MiNote[]).map(note => [note.id, note]));
		const replyNotes = replyIds.map(id => referencedNotesById.get(id)).filter((note): note is MiNote => note != null);
		const renoteNotes = renoteIds.map(id => referencedNotesById.get(id)).filter((note): note is MiNote => note != null);
		const [packedReplyList, packedRenoteList] = await Promise.all([
			replyNotes.length > 0 ? this.noteEntityService.packMany(replyNotes, me, { detail: false }) : Promise.resolve([]),
			renoteNotes.length > 0 ? this.noteEntityService.packMany(renoteNotes, me, { detail: true }) : Promise.resolve([]),
		]);
		const packedReplies = new Map<MiNote['id'], Packed<'Note'> | null>(replyIds.map(id => [id, null]));
		for (const packed of packedReplyList) packedReplies.set(packed.id, packed);
		const packedRenotes = new Map<MiNote['id'], Packed<'Note'> | null>(renoteIds.map(id => [id, null]));
		for (const packed of packedRenoteList) packedRenotes.set(packed.id, packed);

		return await Promise.all(noteDrafts.map(n => this.pack(n, me, {
			...options,
			_hint_: {
				packedFiles,
				packedUsers,
				channels,
				packedReplies,
				packedRenotes,
			},
		})));
	}

	@bindThis
	private async findChannelsBatch(ids: readonly string[]): Promise<ReadonlyMap<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>> {
		const rows = ids.length > 0 ? await this.channelsRepository.findBy({ id: In([...ids]) }) : [];
		const result = new Map<string, Awaited<ReturnType<ChannelsRepository['findOneBy']>>>(ids.map(id => [id, null]));
		for (const row of rows) result.set(row.id, row);
		return result;
	}

	@bindThis
	private async findNoteDraftsBatch(ids: readonly string[]): Promise<ReadonlyMap<string, MiNoteDraft>> {
		const drafts = await this.noteDraftsRepository.find({
			where: { id: In([...ids]) },
			relations: {
				user: true,
			},
		});
		return new Map(drafts.map(draft => [draft.id, draft]));
	}
}
