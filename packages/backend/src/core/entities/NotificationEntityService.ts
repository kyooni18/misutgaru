/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { FollowRequestsRepository, NotesRepository, MiUser, UsersRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiGroupedNotification, MiNotification } from '@/models/Notification.js';
import type { MiNote } from '@/models/Note.js';
import type { Packed } from '@/misc/json-schema.js';
import { bindThis } from '@/decorators.js';
import { FilterUnionByProperty, groupedNotificationTypes } from '@/types.js';
import { CacheService } from '@/core/CacheService.js';
import { RoleEntityService } from './RoleEntityService.js';
import { ChatEntityService } from './ChatEntityService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { UserEntityService } from './UserEntityService.js';
import type { NoteEntityService } from './NoteEntityService.js';

const NOTE_REQUIRED_NOTIFICATION_TYPES = new Set([
	'note',
	'mention',
	'reply',
	'renote',
	'renote:grouped',
	'quote',
	'reaction',
	'reaction:grouped',
	'pollEnded',
	'scheduledNotePosted',
] as (typeof groupedNotificationTypes[number])[]);

@Injectable()
export class NotificationEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private noteEntityService: NoteEntityService;
	private roleEntityService: RoleEntityService;
	private chatEntityService: ChatEntityService;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.followRequestsRepository)
		private followRequestsRepository: FollowRequestsRepository,

		private cacheService: CacheService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.noteEntityService = this.moduleRef.get('NoteEntityService');
		this.roleEntityService = this.moduleRef.get('RoleEntityService');
		this.chatEntityService = this.moduleRef.get('ChatEntityService');
	}

	/**
	 * 通知をパックする共通処理
	*/
	async #packInternal <T extends MiNotification | MiGroupedNotification> (
		src: T,
		meId: MiUser['id'],
		options: {
			checkValidNotifier?: boolean;
		},
		hint?: {
			packedNotes: Map<MiNote['id'], Packed<'Note'>>;
			packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
		},
	): Promise<Packed<'Notification'> | null> {
		const notification = src;

		if (options.checkValidNotifier !== false && !(await this.#isValidNotifier(notification, meId))) return null;

		const needsNote = NOTE_REQUIRED_NOTIFICATION_TYPES.has(notification.type) && 'noteId' in notification;
		const noteIfNeed = needsNote ? (
			hint?.packedNotes != null
				? hint.packedNotes.get(notification.noteId)
				: this.noteEntityService.pack(notification.noteId, { id: meId }, {
					detail: true,
				})
		) : undefined;
		// if the note has been deleted, don't show this notification
		if (needsNote && !noteIfNeed) return null;

		const needsUser = 'notifierId' in notification;
		const userIfNeed = needsUser ? (
			hint?.packedUsers != null
				? hint.packedUsers.get(notification.notifierId)
				: this.userEntityService.pack(notification.notifierId, { id: meId })
		) : undefined;
		// if the user has been deleted, don't show this notification
		if (needsUser && !userIfNeed) return null;

		//#region Grouped notifications
		if (notification.type === 'reaction:grouped') {
			const reactions = (await Promise.all(notification.reactions.map(async reaction => {
				const user = hint?.packedUsers != null
					? hint.packedUsers.get(reaction.userId)!
					: await this.userEntityService.pack(reaction.userId, { id: meId });
				return {
					user,
					reaction: reaction.reaction,
				};
			}))).filter(r => r.user != null);
			// if all users have been deleted, don't show this notification
			if (reactions.length === 0) {
				return null;
			}

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				note: noteIfNeed,
				reactions,
			});
		} else if (notification.type === 'renote:grouped') {
			const users = (await Promise.all(notification.userIds.map(userId => {
				if (hint?.packedUsers != null) return hint.packedUsers.get(userId);
				return this.userEntityService.pack(userId, { id: meId });
			}))).filter(x => x != null);
			// if all users have been deleted, don't show this notification
			if (users.length === 0) {
				return null;
			}

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				note: noteIfNeed,
				users,
			});
		}
		//#endregion

		const needsRole = notification.type === 'roleAssigned';
		const role = needsRole ? await this.roleEntityService.pack(notification.roleId) : undefined;
		// if the role has been deleted, don't show this notification
		if (needsRole && !role) {
			return null;
		}

		const needsChatRoomInvitation = notification.type === 'chatRoomInvitationReceived';
		const chatRoomInvitation = needsChatRoomInvitation ? await this.chatEntityService.packRoomInvitation(notification.invitationId, { id: meId }).catch(() => null) : undefined;
		// if the invitation has been deleted, don't show this notification
		if (needsChatRoomInvitation && !chatRoomInvitation) {
			return null;
		}

		return await awaitAll({
			id: notification.id,
			createdAt: new Date(notification.createdAt).toISOString(),
			type: notification.type,
			userId: 'notifierId' in notification ? notification.notifierId : undefined,
			...(userIfNeed != null ? { user: userIfNeed } : {}),
			...(noteIfNeed != null ? { note: noteIfNeed } : {}),
			...(notification.type === 'reaction' ? {
				reaction: notification.reaction,
			} : {}),
			...(notification.type === 'roleAssigned' ? {
				role: role,
			} : {}),
			...(notification.type === 'chatRoomInvitationReceived' ? {
				invitation: chatRoomInvitation,
			} : {}),
			...(notification.type === 'followRequestAccepted' ? {
				message: notification.message,
			} : {}),
			...(notification.type === 'achievementEarned' ? {
				achievement: notification.achievement,
			} : {}),
			...(notification.type === 'exportCompleted' ? {
				exportedEntity: notification.exportedEntity,
				fileId: notification.fileId,
			} : {}),
			...(notification.type === 'app' ? {
				body: notification.customBody,
				header: notification.customHeader,
				icon: notification.customIcon,
			} : {}),
		});
	}

	async #packManyInternal <T extends MiNotification | MiGroupedNotification>	(
		notifications: T[],
		meId: MiUser['id'],
	): Promise<T[]> {
		if (notifications.length === 0) return [];

		const allUserIds = new Set<MiUser['id']>();
		for (const notification of notifications) {
			if ('notifierId' in notification) allUserIds.add(notification.notifierId);
			if (notification.type === 'reaction:grouped') for (const reaction of notification.reactions) allUserIds.add(reaction.userId);
			if (notification.type === 'renote:grouped') for (const userId of notification.userIds) allUserIds.add(userId);
		}

		const [userIdsWhoMeMuting, userMutedInstances, userRows] = await Promise.all([
			this.cacheService.userMutingsCache.fetch(meId),
			this.cacheService.userProfileCache.fetch(meId).then(profile => new Set(profile.mutedInstances)),
			allUserIds.size > 0 ? this.usersRepository.find({ where: { id: In([...allUserIds]) } }) : Promise.resolve([]),
		]);
		const usersById = new Map<MiUser['id'], MiUser>();
		for (const user of userRows as MiUser[]) usersById.set(user.id, user);
		let validNotifications = notifications.filter(notification => this.#validateNotifier(notification, userIdsWhoMeMuting, userMutedInstances, usersById));

		const noteIds = [...new Set(validNotifications.map(x => 'noteId' in x ? x.noteId : null).filter(x => x != null))];
		const notes = noteIds.length > 0 ? await this.notesRepository.find({
			where: { id: In(noteIds) },
			relations: {
				user: true,
				reply: {
					user: true,
				},
				renote: {
					user: true,
				},
			},
		}) : [];
		const packedNotesArray = await this.noteEntityService.packMany(notes, { id: meId }, {
			detail: true,
		});
		const packedNotes = new Map(packedNotesArray.map(p => [p.id, p]));

		validNotifications = validNotifications.filter(x => !('noteId' in x) || packedNotes.has(x.noteId));

		const userIds = new Set<MiUser['id']>();
		for (const notification of validNotifications) {
			if ('notifierId' in notification) userIds.add(notification.notifierId);
			if (notification.type === 'reaction:grouped') for (const reaction of notification.reactions) userIds.add(reaction.userId);
			if (notification.type === 'renote:grouped') for (const userId of notification.userIds) userIds.add(userId);
		}
		const users: MiUser[] = [];
		for (const userId of userIds) {
			const user = usersById.get(userId);
			if (user) users.push(user);
		}
		const packedUsersArray = await this.userEntityService.packMany(users, { id: meId });
		const packedUsers = new Map(packedUsersArray.map(p => [p.id, p]));

		// 既に解決されたフォローリクエストの通知を除外
		const followRequestNotifications = validNotifications.filter((x): x is FilterUnionByProperty<T, 'type', 'receiveFollowRequest'> => x.type === 'receiveFollowRequest');
		if (followRequestNotifications.length > 0) {
			const reqs = await this.followRequestsRepository.find({
				where: { followerId: In([...new Set(followRequestNotifications.map(x => x.notifierId))]) },
			});
			const followerIdsWithRequest = new Set<MiUser['id']>();
			for (const request of reqs) followerIdsWithRequest.add(request.followerId);
			validNotifications = validNotifications.filter(x => (x.type !== 'receiveFollowRequest') || followerIdsWithRequest.has(x.notifierId));
		}

		const packPromises = validNotifications.map(x => {
			return this.pack(
				x,
				meId,
				{ checkValidNotifier: false },
				{ packedNotes, packedUsers },
			);
		});

		return (await Promise.all(packPromises)).filter(x => x != null);
	}

	@bindThis
	public async pack(
		src: MiNotification | MiGroupedNotification,
		meId: MiUser['id'],

		options: {
			checkValidNotifier?: boolean;
		},
		hint?: {
			packedNotes: Map<MiNote['id'], Packed<'Note'>>;
			packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
		},
	): Promise<Packed<'Notification'> | null> {
		return await this.#packInternal(src, meId, options, hint);
	}

	@bindThis
	public async packMany(
		notifications: MiNotification[],
		meId: MiUser['id'],
	): Promise<MiNotification[]> {
		return await this.#packManyInternal(notifications, meId);
	}

	@bindThis
	public async packGroupedMany(
		notifications: MiGroupedNotification[],
		meId: MiUser['id'],
	): Promise<MiGroupedNotification[]> {
		return await this.#packManyInternal(notifications, meId);
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを確認するvalidator
	 */
	#validateNotifier <T extends MiNotification | MiGroupedNotification> (
		notification: T,
		userIdsWhoMeMuting: Set<MiUser['id']>,
		userMutedInstances: Set<string>,
		notifiers: ReadonlyMap<MiUser['id'], MiUser>,
	): boolean {
		if (!('notifierId' in notification)) return true;
		if (userIdsWhoMeMuting.has(notification.notifierId)) return false;

		const notifier = notifiers.get(notification.notifierId) ?? null;

		if (notifier == null) return false;
		if (notifier.host && userMutedInstances.has(notifier.host)) return false;

		if (notifier.isSuspended) return false;

		return true;
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを実際に確認する
	 */
	async #isValidNotifier(
		notification: MiNotification | MiGroupedNotification,
		meId: MiUser['id'],
	): Promise<boolean> {
		return (await this.#filterValidNotifier([notification], meId)).length === 1;
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを実際に複数確認する
	 */
	async #filterValidNotifier <T extends MiNotification | MiGroupedNotification> (
		notifications: T[],
		meId: MiUser['id'],
	): Promise<T[]> {
		const [
			userIdsWhoMeMuting,
			userMutedInstances,
		] = await Promise.all([
			this.cacheService.userMutingsCache.fetch(meId),
			this.cacheService.userProfileCache.fetch(meId).then(p => new Set(p.mutedInstances)),
		]);

		const notifierIds = [...new Set(notifications.map(notification => 'notifierId' in notification ? notification.notifierId : null).filter(x => x != null))];
		const notifierRows = notifierIds.length > 0 ? await this.usersRepository.find({
			where: { id: In(notifierIds) },
		}) : [];
		const notifiers = new Map<MiUser['id'], MiUser>();
		for (const notifier of notifierRows as MiUser[]) notifiers.set(notifier.id, notifier);

		return notifications.filter(notification => this.#validateNotifier(notification, userIdsWhoMeMuting, userMutedInstances, notifiers));
	}
}
