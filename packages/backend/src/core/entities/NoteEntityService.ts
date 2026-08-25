/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundError, In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { DI } from '@/di-symbols.js';
import type { Packed } from '@/misc/json-schema.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser } from '@/models/User.js';
import type { MiNote } from '@/models/Note.js';
import type { UsersRepository, NotesRepository, FollowingsRepository, PollsRepository, PollVotesRepository, NoteReactionsRepository, ChannelsRepository, MiMeta, MiChannel, MiPoll, MiPollVote } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { DebounceLoader } from '@/misc/loader.js';
import { IdService } from '@/core/IdService.js';
import { shouldHideNoteByTime } from '@/misc/should-hide-note-by-time.js';
import { ReactionsBufferingService } from '@/core/ReactionsBufferingService.js';
import { CacheService } from '@/core/CacheService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { ReactionService } from '../ReactionService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';

// is-renote.tsとよしなにリンク
function isPureRenote(note: MiNote): note is MiNote & { renoteId: MiNote['id']; renote: MiNote } {
	return (
		note.renote != null &&
		note.reply == null &&
		note.text == null &&
		note.cw == null &&
		(note.fileIds == null || note.fileIds.length === 0) &&
		!note.hasPoll
	);
}

function getAppearNoteIds(notes: MiNote[]): Set<string> {
	const appearNoteIds = new Set<string>();
	for (const note of notes) {
		if (isPureRenote(note)) {
			appearNoteIds.add(note.renoteId);
		} else {
			appearNoteIds.add(note.id);
		}
	}
	return appearNoteIds;
}


function sumReactionCounts(reactions: MiNote['reactions']): number {
	let total = 0;
	for (const reaction in reactions) {
		if (Object.hasOwn(reactions, reaction)) total += reactions[reaction] ?? 0;
	}
	return total;
}

function collectPackingNotes(notes: MiNote[]): MiNote[] {
	const byId = new Map<MiNote['id'], MiNote>();
	const stack = [...notes];
	while (stack.length > 0) {
		const note = stack.pop()!;
		if (byId.has(note.id)) continue;
		byId.set(note.id, note);
		if (note.reply) stack.push(note.reply);
		if (note.renote) stack.push(note.renote);
	}
	return [...byId.values()];
}

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

@Injectable()
export class NoteEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private customEmojiService: CustomEmojiService;
	private reactionService: ReactionService;
	private reactionsBufferingService: ReactionsBufferingService;
	private idService: IdService;
	private cacheService: CacheService;
	private noteLoader = new DebounceLoader(this.findNoteOrFail);

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		//private userEntityService: UserEntityService,
		//private driveFileEntityService: DriveFileEntityService,
		//private customEmojiService: CustomEmojiService,
		//private reactionService: ReactionService,
		//private reactionsBufferingService: ReactionsBufferingService,
		//private idService: IdService,
		//private cacheService: CacheService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.reactionService = this.moduleRef.get('ReactionService');
		this.reactionsBufferingService = this.moduleRef.get('ReactionsBufferingService');
		this.idService = this.moduleRef.get('IdService');
		this.cacheService = this.moduleRef.get('CacheService');
	}

	@bindThis
	private treatVisibility(packedNote: Packed<'Note'>): Packed<'Note'>['visibility'] {
		if (packedNote.visibility === 'public' || packedNote.visibility === 'home') {
			const followersOnlyBefore = packedNote.user.makeNotesFollowersOnlyBefore;
			if (shouldHideNoteByTime(followersOnlyBefore, packedNote.createdAt)) {
				packedNote.visibility = 'followers';
			}
		}
		return packedNote.visibility;
	}

	@bindThis
	public async shouldHideNote(packedNote: Packed<'Note'>, meId: MiUser['id'] | null): Promise<boolean> {
		if (meId === packedNote.userId) return false;
		// TODO: isVisibleForMe を使うようにしても良さそう(型違うけど)

		if (packedNote.user.requireSigninToViewContents && meId == null) {
			return true;
		}

		const hiddenBefore = packedNote.user.makeNotesHiddenBefore;
		if (shouldHideNoteByTime(hiddenBefore, packedNote.createdAt)) {
			return true;
		}

		// visibility が specified かつ自分が指定されていなかったら非表示
		if (packedNote.visibility === 'specified') {
			if (meId == null) {
				return true;
			} else {
				// 指定されているかどうか
				const specified = packedNote.visibleUserIds!.some(id => meId === id);

				if (!specified) {
					return true;
				}
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (packedNote.visibility === 'followers') {
			if (meId == null) {
				return true;
			} else if (packedNote.reply && (meId === packedNote.reply.userId)) {
				// 自分の投稿に対するリプライ
				return false;
			} else if (packedNote.mentions && packedNote.mentions.some(id => meId === id)) {
				// 自分へのメンション
				return false;
			} else {
				// フォロワーかどうか
				const followings = await this.cacheService.userFollowingsCache.fetch(meId);
				if (!Object.hasOwn(followings, packedNote.userId)) {
					return true;
				}
			}
		}

		return false;
	}

	@bindThis
	public hideNote(packedNote: Packed<'Note'>): void {
		packedNote.visibleUserIds = undefined;
		packedNote.fileIds = [];
		packedNote.files = [];
		packedNote.text = null;
		packedNote.poll = undefined;
		packedNote.cw = null;
		packedNote.isHidden = true;
		// TODO: hiddenReason みたいなのを提供しても良さそう
	}

	@bindThis
	private async populatePoll(note: MiNote, meId: MiUser['id'] | null, hint?: {
		poll?: MiPoll;
		votes?: MiPollVote[];
	}) {
		const poll: MiPoll = hint?.poll ?? await this.pollsRepository.findOneByOrFail({ noteId: note.id });
		const choices = poll.choices.map((c, index) => ({
			text: c,
			votes: poll.votes[index],
			isVoted: false,
		}));

		if (meId) {
			if (poll.multiple) {
				const votes: MiPollVote[] = hint?.votes ?? await this.pollVotesRepository.findBy({
					userId: meId,
					noteId: note.id,
				});

				const myChoices = votes.map(v => v.choice);
				for (const myChoice of myChoices) {
					choices[myChoice].isVoted = true;
				}
			} else {
				const vote = hint?.votes !== undefined
					? (hint.votes[0] ?? null)
					: await this.pollVotesRepository.findOneBy({
						userId: meId,
						noteId: note.id,
					});

				if (vote) {
					choices[vote.choice].isVoted = true;
				}
			}
		}

		return {
			multiple: poll.multiple,
			expiresAt: poll.expiresAt?.toISOString() ?? null,
			choices,
		};
	}

	@bindThis
	public async populateMyReaction(note: { id: MiNote['id']; reactions: MiNote['reactions']; reactionAndUserPairCache?: MiNote['reactionAndUserPairCache']; }, meId: MiUser['id'], _hint_?: {
		myReactions: Map<MiNote['id'], string | null>;
	}) {
		if (_hint_?.myReactions) {
			const reaction = _hint_.myReactions.get(note.id);
			if (reaction) {
				return this.reactionService.convertLegacyReaction(reaction);
			} else {
				return undefined;
			}
		}

		const reactionsCount = sumReactionCounts(note.reactions);
		if (reactionsCount === 0) return undefined;
		if (note.reactionAndUserPairCache && reactionsCount <= note.reactionAndUserPairCache.length) {
			const pair = note.reactionAndUserPairCache.find(p => p.startsWith(meId));
			if (pair) {
				return this.reactionService.convertLegacyReaction(pair.split('/')[1]);
			} else {
				return undefined;
			}
		}

		// パフォーマンスのためノートが作成されてから2秒以上経っていない場合はリアクションを取得しない
		if (this.idService.parse(note.id).date.getTime() + 2000 > Date.now()) {
			return undefined;
		}

		const reaction = await this.noteReactionsRepository.findOneBy({
			userId: meId,
			noteId: note.id,
		});

		if (reaction) {
			return this.reactionService.convertLegacyReaction(reaction.reaction);
		}

		return undefined;
	}

	@bindThis
	public async isVisibleForMe(note: MiNote, meId: MiUser['id'] | null): Promise<boolean> {
		// This code must always be synchronized with the checks in QueryService.generateVisibilityQuery.
		// visibility が specified かつ自分が指定されていなかったら非表示
		if (note.visibility === 'specified') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return note.visibleUserIds.some(id => meId === id);
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (note.visibility === 'followers') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (note.reply && (meId === note.reply.userId)) {
				// 自分の投稿に対するリプライ
				return true;
			} else if (note.mentions && note.mentions.some(id => meId === id)) {
				// 自分へのメンション
				return true;
			} else {
				// フォロワーかどうか
				const [following, user] = await Promise.all([
					this.followingsRepository.count({
						where: {
							followeeId: note.userId,
							followerId: meId,
						},
						take: 1,
					}),
					this.usersRepository.findOneByOrFail({ id: meId }),
				]);

				/* If we know the following, everyhting is fine.

				But if we do not know the following, it might be that both the
				author of the note and the author of the like are remote users,
				in which case we can never know the following. Instead we have
				to assume that the users are following each other.
				*/
				return following > 0 || (note.userHost != null && user.host != null);
			}
		}

		return true;
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
		src: MiNote['id'] | MiNote,
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
			withReactionAndUserPairCache?: boolean;
			_hint_?: {
				bufferedReactions: Map<MiNote['id'], { deltas: Record<string, number>; pairs: ([MiUser['id'], string])[] }> | null;
				myReactions: Map<MiNote['id'], string | null>;
				packedFiles: Map<MiNote['fileIds'][number], Packed<'DriveFile'> | null>;
				packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
				channels?: Map<MiChannel['id'], MiChannel | null>;
				polls?: Map<MiNote['id'], MiPoll>;
				pollVotes?: Map<MiNote['id'], MiPollVote[]>;
			};
		},
	): Promise<Packed<'Note'>> {
		const opts = Object.assign({
			detail: true,
			skipHide: false,
			withReactionAndUserPairCache: false,
		}, options);

		const meId = me ? me.id : null;
		const note = typeof src === 'object' ? src : await this.noteLoader.load(src);
		const host = note.userHost;

		const bufferedReactions = opts._hint_?.bufferedReactions != null
			? (opts._hint_.bufferedReactions.get(note.id) ?? { deltas: {}, pairs: [] })
			: this.meta.enableReactionsBuffering
				? await this.reactionsBufferingService.get(note.id)
				: { deltas: {}, pairs: [] };
		const reactions = this.reactionService.convertLegacyReactions(this.reactionsBufferingService.mergeReactions(note.reactions, bufferedReactions.deltas ?? {}));
		const reactionKeys = Object.keys(reactions);
		const reactionCount = sumReactionCounts(reactions);
		const needsReactionPairCache = opts.withReactionAndUserPairCache || (opts.detail && meId != null && reactionCount > 0);
		const reactionAndUserPairCache = needsReactionPairCache
			? (bufferedReactions.pairs.length > 0
				? note.reactionAndUserPairCache.concat(bufferedReactions.pairs.map(x => x.join('/')))
				: note.reactionAndUserPairCache)
			: undefined;

		let text = note.text;

		if (note.name && (note.url ?? note.uri)) {
			text = `【${note.name}】\n${(note.text ?? '').trim()}\n\n${note.url ?? note.uri}`;
		}

		let channel: MiChannel | null = note.channel ?? null;
		if (note.channelId && note.channel == null) {
			const hintedChannels = opts._hint_?.channels;
			channel = hintedChannels?.has(note.channelId)
				? (hintedChannels.get(note.channelId) ?? null)
				: await this.channelsRepository.findOneBy({ id: note.channelId });
		}

		const reactionEmojiNames: string[] = [];
		for (const reaction of reactionKeys) {
			if (reaction.startsWith(':') && reaction.includes('@') && !reaction.includes('@.')) {
				reactionEmojiNames.push(this.reactionService.decodeReaction(reaction).reaction.replaceAll(':', ''));
			}
		}
		const packedFiles = options?._hint_?.packedFiles;
		const packedUsers = options?._hint_?.packedUsers;

		const packed: Packed<'Note'> = await awaitAll({
			id: note.id,
			createdAt: this.idService.parse(note.id).date.toISOString(),
			userId: note.userId,
			user: packedUsers?.get(note.userId) ?? this.userEntityService.pack(note.user ?? note.userId, me),
			text: text,
			cw: note.cw,
			visibility: note.visibility,
			localOnly: note.localOnly,
			reactionAcceptance: note.reactionAcceptance,
			visibleUserIds: note.visibility === 'specified' ? note.visibleUserIds : undefined,
			renoteCount: note.renoteCount,
			repliesCount: note.repliesCount,
			reactionCount: reactionCount,
			reactions: reactions,
			reactionEmojis: this.customEmojiService.populateEmojis(reactionEmojiNames, host),
			reactionAndUserPairCache: opts.withReactionAndUserPairCache ? reactionAndUserPairCache : undefined,
			emojis: host != null ? this.customEmojiService.populateEmojis(note.emojis, host) : undefined,
			tags: note.tags.length > 0 ? note.tags : undefined,
			fileIds: note.fileIds,
			files: packedFiles != null ? this.packAttachedFiles(note.fileIds, packedFiles) : this.driveFileEntityService.packManyByIds(note.fileIds),
			replyId: note.replyId,
			renoteId: note.renoteId,
			channelId: note.channelId ?? undefined,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
				color: channel.color,
				isSensitive: channel.isSensitive,
				allowRenoteToExternal: channel.allowRenoteToExternal,
				userId: channel.userId,
			} : undefined,
			mentions: note.mentions.length > 0 ? note.mentions : undefined,
			hasPoll: note.hasPoll || undefined,
			uri: note.uri ?? undefined,
			url: note.url ?? undefined,

			...(opts.detail ? {
				clippedCount: note.clippedCount,

				// そもそもJOINしていない場合はundefined、JOINしたけど存在していなかった場合はnullで区別される
				reply: (note.replyId && note.reply === null) ? null : note.replyId ? nullIfEntityNotFound(this.pack(note.reply ?? note.replyId, me, {
					detail: false,
					skipHide: opts.skipHide,
					withReactionAndUserPairCache: opts.withReactionAndUserPairCache,
					_hint_: options?._hint_,
				})) : undefined,

				// そもそもJOINしていない場合はundefined、JOINしたけど存在していなかった場合はnullで区別される
				renote: (note.renoteId && note.renote === null) ? null : note.renoteId ? nullIfEntityNotFound(this.pack(note.renote ?? note.renoteId, me, {
					detail: true,
					skipHide: opts.skipHide,
					withReactionAndUserPairCache: opts.withReactionAndUserPairCache,
					_hint_: options?._hint_,
				})) : undefined,

				poll: note.hasPoll ? this.populatePoll(note, meId, {
					poll: opts._hint_?.polls?.get(note.id),
					votes: opts._hint_?.pollVotes?.get(note.id),
				}) : undefined,

				...(meId && reactionCount > 0 ? {
					myReaction: this.populateMyReaction({
						id: note.id,
						reactions: reactions,
						reactionAndUserPairCache: reactionAndUserPairCache!,
					}, meId, options?._hint_),
				} : {}),
			} : {}),
		});

		this.treatVisibility(packed);

		if (!opts.skipHide && (await this.shouldHideNote(packed, meId))) {
			this.hideNote(packed);
		}

		return packed;
	}

	@bindThis
	public async packMany(
		notes: MiNote[],
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
		},
	) {
		if (notes.length === 0) return [];

		const packingNotes = collectPackingNotes(notes);
		const bufferedReactions = this.meta.enableReactionsBuffering
			? await this.reactionsBufferingService.getMany([...getAppearNoteIds(packingNotes)])
			: null;

		const meId = me ? me.id : null;
		const myReactionsMap = new Map<MiNote['id'], string | null>();
		if (meId) {
			const idsNeedFetchMyReaction = new Set<MiNote['id']>();
			const appearNotes = new Map<MiNote['id'], MiNote>();
			const pureRenoteTargets = new Set<MiNote['id']>();
			for (const note of packingNotes) {
				const pure = isPureRenote(note);
				const appear = pure ? note.renote : note;
				if (pure) pureRenoteTargets.add(appear.id);
				if (!appearNotes.has(appear.id)) appearNotes.set(appear.id, appear);
			}

			// パフォーマンスのためノートが作成されてから2秒以上経っていない場合はリアクションを取得しない
			const oldId = this.idService.gen(Date.now() - 2000);

			for (const note of appearNotes.values()) {
				if (note.id >= oldId && !pureRenoteTargets.has(note.id)) {
					myReactionsMap.set(note.id, null);
					continue;
				}

				const buffered = bufferedReactions?.get(note.id);
				const merged = this.reactionsBufferingService.mergeReactions(note.reactions, buffered?.deltas ?? {});
				const reactionsCount = sumReactionCounts(merged);
				if (reactionsCount === 0) {
					myReactionsMap.set(note.id, null);
				} else if (reactionsCount <= note.reactionAndUserPairCache.length + (buffered?.pairs.length ?? 0)) {
					const pairInBuffer = buffered?.pairs.find(p => p[0] === meId);
					if (pairInBuffer) {
						myReactionsMap.set(note.id, pairInBuffer[1]);
					} else {
						const pair = note.reactionAndUserPairCache.find(p => p.startsWith(meId));
						myReactionsMap.set(note.id, pair ? pair.split('/')[1] : null);
					}
				} else {
					idsNeedFetchMyReaction.add(note.id);
				}
			}

			if (idsNeedFetchMyReaction.size > 0) {
				const myReactions = await this.noteReactionsRepository.findBy({
					userId: meId,
					noteId: In([...idsNeedFetchMyReaction]),
				});
				const byNoteId = new Map<MiNote['id'], string>();
				for (const reaction of myReactions) byNoteId.set(reaction.noteId, reaction.reaction);
				for (const id of idsNeedFetchMyReaction) {
					myReactionsMap.set(id, byNoteId.get(id) ?? null);
				}
			}
		}

		await this.customEmojiService.prefetchEmojis(this.aggregateNoteEmojis(packingNotes));

		const fileIdSet = new Set<MiNote['fileIds'][number]>();
		const channelIdSet = new Set<MiChannel['id']>();
		const pollNoteIdSet = new Set<MiNote['id']>();
		const usersById = new Map<MiUser['id'], MiUser | MiUser['id']>();
		for (const note of packingNotes) {
			for (const fileId of note.fileIds) fileIdSet.add(fileId);
			if (note.channelId) channelIdSet.add(note.channelId);
			if (note.hasPoll) pollNoteIdSet.add(note.id);

			const user = note.user ?? note.userId;
			const existing = usersById.get(note.userId);
			if (existing == null || typeof user === 'object') usersById.set(note.userId, user);
		}

		const fileIds = [...fileIdSet];
		const channelIds = [...channelIdSet];
		const pollNoteIds = [...pollNoteIdSet];

		const packedFilesPromise: Promise<Map<string, Packed<'DriveFile'> | null>> = fileIds.length > 0
			? this.driveFileEntityService.packManyByIdsMap(fileIds)
			: Promise.resolve(new Map());
		const channelsPromise: Promise<MiChannel[]> = channelIds.length > 0
			? this.channelsRepository.findBy({ id: In(channelIds) })
			: Promise.resolve([]);
		const pollsPromise: Promise<MiPoll[]> = pollNoteIds.length > 0
			? this.pollsRepository.findBy({ noteId: In(pollNoteIds) })
			: Promise.resolve([]);
		const pollVotesPromise: Promise<MiPollVote[]> = meId && pollNoteIds.length > 0
			? this.pollVotesRepository.findBy({ userId: meId, noteId: In(pollNoteIds) })
			: Promise.resolve([]);
		const packedUserListPromise: Promise<Packed<'UserLite'>[]> = usersById.size > 0
			? this.userEntityService.packMany([...usersById.values()], me)
			: Promise.resolve([]);
		const [packedFiles, channels, polls, pollVotes, packedUserList] = await Promise.all([
			packedFilesPromise, channelsPromise, pollsPromise, pollVotesPromise, packedUserListPromise,
		]);

		const packedUsers = new Map<MiUser['id'], Packed<'UserLite'>>();
		for (const packedUser of packedUserList) packedUsers.set(packedUser.id, packedUser);
		const channelsMap = new Map<MiChannel['id'], MiChannel | null>(channelIds.map(id => [id, null]));
		for (const channel of channels) channelsMap.set(channel.id, channel);
		const pollsMap = new Map<MiNote['id'], MiPoll>();
		for (const poll of polls) pollsMap.set(poll.noteId, poll);
		const pollVotesMap = new Map<MiNote['id'], MiPollVote[]>(pollNoteIds.map(id => [id, []]));
		for (const vote of pollVotes) pollVotesMap.get(vote.noteId)!.push(vote);

		return await Promise.all(notes.map(n => this.pack(n, me, {
			...options,
			_hint_: {
				bufferedReactions,
				myReactions: myReactionsMap,
				packedFiles,
				packedUsers,
				channels: channelsMap,
				polls: pollsMap,
				pollVotes: pollVotesMap,
			},
		})));

	}

	@bindThis
	public aggregateNoteEmojis(notes: MiNote[]) {
		const emojis: { name: string; host: string; }[] = [];
		const appendEmojiStrings = (values: string[], userHost: string | null) => {
			for (const value of values) {
				const emoji = this.customEmojiService.parseEmojiStr(value, userHost);
				if (emoji.name != null && emoji.host != null) emojis.push({ name: emoji.name, host: emoji.host });
			}
		};

		for (const note of notes) {
			appendEmojiStrings(note.emojis, note.userHost);
			if (note.renote) {
				appendEmojiStrings(note.renote.emojis, note.renote.userHost);
				if (note.renote.user) appendEmojiStrings(note.renote.user.emojis, note.renote.userHost);
			}
			for (const reaction in note.reactions) {
				if (!Object.hasOwn(note.reactions, reaction)) continue;
				const decoded = this.reactionService.decodeReaction(reaction);
				if (decoded.name != null && decoded.host != null) emojis.push({ name: decoded.name, host: decoded.host });
			}
			if (note.user) appendEmojiStrings(note.user.emojis, note.userHost);
		}
		return emojis;
	}

	@bindThis
	private findNoteOrFail(id: string): Promise<MiNote> {
		return this.notesRepository.findOneOrFail({
			where: { id },
			relations: {
				user: true,
				renote: true,
				reply: true,
			},
		});
	}

	@bindThis
	public async fetchDiffs(noteIds: MiNote['id'][]) {
		if (noteIds.length === 0) return [];

		const notes = await this.notesRepository.find({
			where: {
				id: In(noteIds),
			},
			select: {
				id: true,
				userHost: true,
				reactions: true,
				reactionAndUserPairCache: true,
			},
		});

		const bufferedReactionsMap = this.meta.enableReactionsBuffering ? await this.reactionsBufferingService.getMany(noteIds) : null;

		const packings = (notes as Array<Pick<MiNote, 'id' | 'userHost' | 'reactions' | 'reactionAndUserPairCache'>>).map(note => {
			const bufferedReactions = bufferedReactionsMap?.get(note.id);
			//const reactionAndUserPairCache = note.reactionAndUserPairCache.concat(bufferedReactions.pairs.map(x => x.join('/')));

			const reactions = this.reactionService.convertLegacyReactions(this.reactionsBufferingService.mergeReactions(note.reactions, bufferedReactions?.deltas ?? {}));

			const reactionEmojiNames: string[] = [];
			for (const reaction in reactions) {
				if (!Object.hasOwn(reactions, reaction)) continue;
				if (reaction.startsWith(':') && reaction.includes('@') && !reaction.includes('@.')) {
					reactionEmojiNames.push(this.reactionService.decodeReaction(reaction).reaction.replaceAll(':', ''));
				}
			}

			return this.customEmojiService.populateEmojis(reactionEmojiNames, note.userHost).then(reactionEmojis => ({
				id: note.id,
				reactions,
				reactionEmojis,
			}));
		});

		return await Promise.all(packings);
	}
}
