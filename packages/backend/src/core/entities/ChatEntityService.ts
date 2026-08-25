/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiUser, ChatMessagesRepository, MiChatMessage, ChatRoomsRepository, MiChatRoom, MiChatRoomInvitation, ChatRoomInvitationsRepository, MiChatRoomMembership, ChatRoomMembershipsRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { In } from 'typeorm';

@Injectable()
export class ChatEntityService {
	constructor(
		@Inject(DI.chatMessagesRepository)
		private chatMessagesRepository: ChatMessagesRepository,

		@Inject(DI.chatRoomsRepository)
		private chatRoomsRepository: ChatRoomsRepository,

		@Inject(DI.chatRoomInvitationsRepository)
		private chatRoomInvitationsRepository: ChatRoomInvitationsRepository,

		@Inject(DI.chatRoomMembershipsRepository)
		private chatRoomMembershipsRepository: ChatRoomMembershipsRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async packMessageDetailed(
		src: MiChatMessage['id'] | MiChatMessage,
		me?: { id: MiUser['id'] },
		options?: {
			_hint_?: {
				packedFiles?: Map<MiChatMessage['fileId'], Packed<'DriveFile'> | null>;
				packedUsers?: Map<MiUser['id'], Packed<'UserLite'>>;
				missingUserIds?: Set<MiUser['id']>;
				packedRooms?: Map<MiChatMessage['toRoomId'], Packed<'ChatRoom'> | null>;
			};
		},
	): Promise<Packed<'ChatMessage'>> {
		const packedUsers = options?._hint_?.packedUsers;
		const packedFiles = options?._hint_?.packedFiles;
		const packedRooms = options?._hint_?.packedRooms;
		const missingUserIds = options?._hint_?.missingUserIds;

		const message = typeof src === 'object' ? src : await this.chatMessagesRepository.findOneByOrFail({ id: src });

		// userは削除されている可能性があるのでnull許容
		const reactions: { user: Packed<'UserLite'> | null; reaction: string; }[] = [];

		for (const record of message.reactions) {
			const [userId, reaction] = record.split('/');
			const packedUser = packedUsers?.get(userId);
			reactions.push({
				user: packedUser ?? (missingUserIds?.has(userId) ? null : await this.userEntityService.pack(userId).catch(() => null)),
				reaction,
			});
		}

		return {
			id: message.id,
			createdAt: this.idService.parse(message.id).date.toISOString(),
			text: message.text,
			fromUserId: message.fromUserId,
			fromUser: packedUsers?.get(message.fromUserId) ?? (await this.userEntityService.pack(message.fromUser ?? message.fromUserId, me)),
			toUserId: message.toUserId,
			toUser: message.toUserId ? (packedUsers?.get(message.toUserId) ?? (await this.userEntityService.pack(message.toUser ?? message.toUserId, me))) : undefined,
			toRoomId: message.toRoomId,
			toRoom: message.toRoomId ? (packedRooms?.get(message.toRoomId) ?? (await this.packRoom(message.toRoom ?? message.toRoomId, me))) : undefined,
			fileId: message.fileId,
			file: message.fileId ? (packedFiles?.get(message.fileId) ?? (await this.driveFileEntityService.pack(message.file ?? message.fileId))) : null,
			reactions: reactions.filter((r): r is { user: Packed<'UserLite'>; reaction: string; } => r.user != null),
		};
	}

	@bindThis
	public async packMessagesDetailed(
		messages: MiChatMessage[],
		me: { id: MiUser['id'] },
	) {
		if (messages.length === 0) return [];

		const usersById = new Map<MiUser['id'], MiUser | MiUser['id']>();
		const fileIds = new Set<NonNullable<MiChatMessage['fileId']>>();
		const roomsById = new Map<NonNullable<MiChatMessage['toRoomId']>, MiChatRoom | MiChatRoom['id']>();

		const addUser = (user: MiUser | MiUser['id'] | null | undefined) => {
			if (user == null) return;
			const id = typeof user === 'string' ? user : user.id;
			const existing = usersById.get(id);
			if (existing == null || typeof user === 'object') usersById.set(id, user);
		};

		for (const message of messages) {
			addUser(message.fromUser ?? message.fromUserId);
			addUser(message.toUser ?? message.toUserId);
			if (message.fileId) fileIds.add(message.fileId);
			if (message.toRoomId) {
				const room = message.toRoom ?? message.toRoomId;
				const existing = roomsById.get(message.toRoomId);
				if (existing == null || typeof room === 'object') roomsById.set(message.toRoomId, room);
			}
			for (const record of message.reactions) addUser(record.split('/', 1)[0]);
		}

		const requestedUserIds = new Set(usersById.keys());
		const [packedUserList, packedFiles, packedRoomList] = await Promise.all([
			this.userEntityService.packMany([...usersById.values()], me),
			fileIds.size > 0 ? this.driveFileEntityService.packManyByIdsMap([...fileIds]) : Promise.resolve(new Map()),
			roomsById.size > 0 ? this.packRooms([...roomsById.values()], me) : Promise.resolve([]),
		]);
		const packedUsers = new Map(packedUserList.map(user => [user.id, user]));
		const missingUserIds = new Set([...requestedUserIds].filter(id => !packedUsers.has(id)));
		const packedRooms = new Map(packedRoomList.map(room => [room.id, room]));

		return Promise.all(messages.map(message => this.packMessageDetailed(message, me, { _hint_: { packedUsers, missingUserIds, packedFiles, packedRooms } })));
	}

	@bindThis
	public async packMessageLiteFor1on1(
		src: MiChatMessage['id'] | MiChatMessage,
		options?: {
			_hint_?: {
				packedFiles: Map<MiChatMessage['fileId'], Packed<'DriveFile'> | null>;
			};
		},
	): Promise<Packed<'ChatMessageLiteFor1on1'>> {
		const packedFiles = options?._hint_?.packedFiles;

		const message = typeof src === 'object' ? src : await this.chatMessagesRepository.findOneByOrFail({ id: src });

		const reactions: { reaction: string; }[] = [];

		for (const record of message.reactions) {
			const [, reaction] = record.split('/');
			reactions.push({
				reaction,
			});
		}

		return {
			id: message.id,
			createdAt: this.idService.parse(message.id).date.toISOString(),
			text: message.text,
			fromUserId: message.fromUserId,
			toUserId: message.toUserId!,
			fileId: message.fileId,
			file: message.fileId ? (packedFiles?.get(message.fileId) ?? (await this.driveFileEntityService.pack(message.file ?? message.fileId))) : null,
			reactions,
		};
	}

	@bindThis
	public async packMessagesLiteFor1on1(
		messages: MiChatMessage[],
	) {
		if (messages.length === 0) return [];

		const fileIds = [...new Set(messages.map(message => message.fileId).filter((id): id is NonNullable<MiChatMessage['fileId']> => id != null))];
		const packedFiles = fileIds.length > 0
			? await this.driveFileEntityService.packManyByIdsMap(fileIds)
			: new Map();

		return Promise.all(messages.map(message => this.packMessageLiteFor1on1(message, { _hint_: { packedFiles } })));
	}

	@bindThis
	public async packMessageLiteForRoom(
		src: MiChatMessage['id'] | MiChatMessage,
		options?: {
			_hint_?: {
				packedFiles: Map<MiChatMessage['fileId'], Packed<'DriveFile'> | null>;
				packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
				missingUserIds?: Set<MiUser['id']>;
			};
		},
	): Promise<Packed<'ChatMessageLiteForRoom'>> {
		const packedFiles = options?._hint_?.packedFiles;
		const packedUsers = options?._hint_?.packedUsers;
		const missingUserIds = options?._hint_?.missingUserIds;

		const message = typeof src === 'object' ? src : await this.chatMessagesRepository.findOneByOrFail({ id: src });

		// userは削除されている可能性があるのでnull許容
		const reactions: { user: Packed<'UserLite'> | null; reaction: string; }[] = [];

		for (const record of message.reactions) {
			const [userId, reaction] = record.split('/');
			const packedUser = packedUsers?.get(userId);
			reactions.push({
				user: packedUser ?? (missingUserIds?.has(userId) ? null : await this.userEntityService.pack(userId).catch(() => null)),
				reaction,
			});
		}

		return {
			id: message.id,
			createdAt: this.idService.parse(message.id).date.toISOString(),
			text: message.text,
			fromUserId: message.fromUserId,
			fromUser: packedUsers?.get(message.fromUserId) ?? (await this.userEntityService.pack(message.fromUser ?? message.fromUserId)),
			toRoomId: message.toRoomId!,
			fileId: message.fileId,
			file: message.fileId ? (packedFiles?.get(message.fileId) ?? (await this.driveFileEntityService.pack(message.file ?? message.fileId))) : null,
			reactions: reactions.filter((r): r is { user: Packed<'UserLite'>; reaction: string; } => r.user != null),
		};
	}

	@bindThis
	public async packMessagesLiteForRoom(
		messages: MiChatMessage[],
	) {
		if (messages.length === 0) return [];

		const usersById = new Map<MiUser['id'], MiUser | MiUser['id']>();
		const fileIds = new Set<NonNullable<MiChatMessage['fileId']>>();
		for (const message of messages) {
			const from = message.fromUser ?? message.fromUserId;
			usersById.set(message.fromUserId, from);
			if (message.fileId) fileIds.add(message.fileId);
			for (const record of message.reactions) {
				const userId = record.split('/', 1)[0];
				if (!usersById.has(userId)) usersById.set(userId, userId);
			}
		}

		const requestedUserIds = new Set(usersById.keys());
		const [packedUserList, packedFiles] = await Promise.all([
			this.userEntityService.packMany([...usersById.values()]),
			fileIds.size > 0 ? this.driveFileEntityService.packManyByIdsMap([...fileIds]) : Promise.resolve(new Map()),
		]);
		const packedUsers = new Map(packedUserList.map(user => [user.id, user]));
		const missingUserIds = new Set([...requestedUserIds].filter(id => !packedUsers.has(id)));

		return Promise.all(messages.map(message => this.packMessageLiteForRoom(message, { _hint_: { packedFiles, packedUsers, missingUserIds } })));
	}

	@bindThis
	public async packRoom(
		src: MiChatRoom['id'] | MiChatRoom,
		me?: { id: MiUser['id'] },
		options?: {
			_hint_?: {
				packedOwners: Map<MiChatRoom['id'], Packed<'UserLite'>>;
				myMemberships?: Map<MiChatRoom['id'], MiChatRoomMembership | null | undefined>;
				myInvitations?: Map<MiChatRoom['id'], MiChatRoomInvitation | null | undefined>;
			};
		},
	): Promise<Packed<'ChatRoom'>> {
		const room = typeof src === 'object' ? src : await this.chatRoomsRepository.findOneByOrFail({ id: src });

		const membershipsHint = options?._hint_?.myMemberships;
		const invitationsHint = options?._hint_?.myInvitations;
		const membership = me && me.id !== room.ownerId
			? (membershipsHint?.has(room.id)
				? (membershipsHint.get(room.id) ?? null)
				: await this.chatRoomMembershipsRepository.findOneBy({ roomId: room.id, userId: me.id }))
			: null;
		const invitation = me && me.id !== room.ownerId
			? (invitationsHint?.has(room.id)
				? (invitationsHint.get(room.id) ?? null)
				: await this.chatRoomInvitationsRepository.findOneBy({ roomId: room.id, userId: me.id }))
			: null;

		return {
			id: room.id,
			createdAt: this.idService.parse(room.id).date.toISOString(),
			name: room.name,
			description: room.description,
			ownerId: room.ownerId,
			owner: options?._hint_?.packedOwners.get(room.ownerId) ?? (await this.userEntityService.pack(room.owner ?? room.ownerId, me)),
			isMuted: membership != null ? membership.isMuted : false,
			invitationExists: invitation != null,
		};
	}

	@bindThis
	public async packRooms(
		rooms: (MiChatRoom | MiChatRoom['id'])[],
		me: { id: MiUser['id'] },
	) {
		if (rooms.length === 0) return [];

		const _rooms = rooms.filter((room): room is MiChatRoom => typeof room !== 'string');
		if (_rooms.length !== rooms.length) {
			_rooms.push(
				...(await this.chatRoomsRepository.find({
					where: {
						id: In(rooms.filter((room): room is string => typeof room === 'string')),
					},
					relations: { owner: true },
				})),
			);
		}

		const owners = _rooms.map(x => x.owner ?? x.ownerId);

		const [packedOwners, myMemberships, myInvitations] = await Promise.all([
			this.userEntityService.packMany(owners, me)
				.then(users => new Map(users.map(u => [u.id, u]))),
			this.chatRoomMembershipsRepository.find({
				where: {
					roomId: In(_rooms.map(x => x.id)),
					userId: me.id,
				},
			}).then((memberships: MiChatRoomMembership[]) => {
				const map = new Map<MiChatRoom['id'], MiChatRoomMembership | null>(_rooms.map(room => [room.id, null]));
				for (const membership of memberships) map.set(membership.roomId, membership);
				return map;
			}),
			this.chatRoomInvitationsRepository.find({
				where: {
					roomId: In(_rooms.map(x => x.id)),
					userId: me.id,
				},
			}).then((invitations: MiChatRoomInvitation[]) => {
				const map = new Map<MiChatRoom['id'], MiChatRoomInvitation | null>(_rooms.map(room => [room.id, null]));
				for (const invitation of invitations) map.set(invitation.roomId, invitation);
				return map;
			}),
		]);

		return Promise.all(_rooms.map(room => this.packRoom(room, me, { _hint_: { packedOwners, myMemberships, myInvitations } })));
	}

	@bindThis
	public async packRoomInvitation(
		src: MiChatRoomInvitation['id'] | MiChatRoomInvitation,
		me: { id: MiUser['id'] },
		options?: {
			_hint_?: {
				packedRooms: Map<MiChatRoomInvitation['roomId'], Packed<'ChatRoom'>>;
				packedUsers: Map<MiChatRoomInvitation['userId'], Packed<'UserLite'>>;
			};
		},
	): Promise<Packed<'ChatRoomInvitation'>> {
		const invitation = typeof src === 'object' ? src : await this.chatRoomInvitationsRepository.findOneByOrFail({ id: src });

		return {
			id: invitation.id,
			createdAt: this.idService.parse(invitation.id).date.toISOString(),
			roomId: invitation.roomId,
			room: options?._hint_?.packedRooms.get(invitation.roomId) ?? (await this.packRoom(invitation.room ?? invitation.roomId, me)),
			userId: invitation.userId,
			user: options?._hint_?.packedUsers.get(invitation.userId) ?? (await this.userEntityService.pack(invitation.user ?? invitation.userId, me)),
		};
	}

	@bindThis
	public async packRoomInvitations(
		invitations: MiChatRoomInvitation[],
		me: { id: MiUser['id'] },
	) {
		if (invitations.length === 0) return [];

		const roomsById = new Map<MiChatRoomInvitation['roomId'], MiChatRoom | MiChatRoom['id']>();
		const usersById = new Map<MiChatRoomInvitation['userId'], MiUser | MiUser['id']>();
		for (const invitation of invitations) {
			const room = invitation.room ?? invitation.roomId;
			const existingRoom = roomsById.get(invitation.roomId);
			if (existingRoom == null || typeof room === 'object') roomsById.set(invitation.roomId, room);
			const user = invitation.user ?? invitation.userId;
			const existingUser = usersById.get(invitation.userId);
			if (existingUser == null || typeof user === 'object') usersById.set(invitation.userId, user);
		}

		const [rooms, users] = await Promise.all([
			this.packRooms([...roomsById.values()], me),
			this.userEntityService.packMany([...usersById.values()], me),
		]);
		const packedRooms = new Map(rooms.map(room => [room.id, room]));
		const packedUsers = new Map(users.map(user => [user.id, user]));

		return Promise.all(invitations.map(invitation => this.packRoomInvitation(invitation, me, { _hint_: { packedRooms, packedUsers } })));
	}

	@bindThis
	public async packRoomMembership(
		src: MiChatRoomMembership['id'] | MiChatRoomMembership,
		me: { id: MiUser['id'] },
		options?: {
			populateUser?: boolean;
			populateRoom?: boolean;
			_hint_?: {
				packedRooms: Map<MiChatRoomMembership['roomId'], Packed<'ChatRoom'>>;
				packedUsers: Map<MiChatRoomMembership['userId'], Packed<'UserLite'>>;
			};
		},
	): Promise<Packed<'ChatRoomMembership'>> {
		const membership = typeof src === 'object' ? src : await this.chatRoomMembershipsRepository.findOneByOrFail({ id: src });

		return {
			id: membership.id,
			createdAt: this.idService.parse(membership.id).date.toISOString(),
			userId: membership.userId,
			user: options?.populateUser ? (options._hint_?.packedUsers.get(membership.userId) ?? (await this.userEntityService.pack(membership.user ?? membership.userId, me))) : undefined,
			roomId: membership.roomId,
			room: options?.populateRoom ? (options._hint_?.packedRooms.get(membership.roomId) ?? (await this.packRoom(membership.room ?? membership.roomId, me))) : undefined,
		};
	}

	@bindThis
	public async packRoomMemberships(
		memberships: MiChatRoomMembership[],
		me: { id: MiUser['id'] },
		options: {
			populateUser?: boolean;
			populateRoom?: boolean;
		} = {},
	) {
		if (memberships.length === 0) return [];

		const packedUsersPromise = options.populateUser
			? this.userEntityService.packMany(memberships.map(x => x.user ?? x.userId), me)
				.then(users => new Map(users.map(user => [user.id, user])))
			: Promise.resolve(new Map<MiUser['id'], Packed<'UserLite'>>());
		const packedRoomsPromise = options.populateRoom
			? this.packRooms(memberships.map(x => x.room ?? x.roomId), me)
				.then(rooms => new Map(rooms.map(room => [room.id, room])))
			: Promise.resolve(new Map<MiChatRoom['id'], Packed<'ChatRoom'>>());

		const [packedUsers, packedRooms] = await Promise.all([packedUsersPromise, packedRoomsPromise]);

		return Promise.all(memberships.map(membership => this.packRoomMembership(membership, me, { ...options, _hint_: { packedUsers, packedRooms } })));
	}
}
