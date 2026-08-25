/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { format as dateFormat } from 'date-fns';
import { DI } from '@/di-symbols.js';
import type { UserListMembershipsRepository, UserListsRepository, UsersRepository, MiUserList, MiUserListMembership } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportUserListsProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		private utilityService: UtilityService,
		private driveService: DriveService,
		private queueLoggerService: QueueLoggerService,
		private notificationService: NotificationService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-user-lists');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting user lists of ${job.data.user.id} ...`);

		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const lists: MiUserList[] = await this.userListsRepository.findBy({
			userId: user.id,
		});

		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`Temp file is ${path}`);

		try {
			const stream = fs.createWriteStream(path, { flags: 'a' });
			const listIds = lists.map((list: MiUserList) => list.id);
			const memberships: MiUserListMembership[] = listIds.length > 0
				? await this.userListMembershipsRepository.findBy({ userListId: In(listIds) }) as MiUserListMembership[]
				: [];
			const membershipsByListId = new Map<string, MiUserListMembership[]>();
			const listIdsByUserId = new Map<MiUser['id'], Set<string>>();
			for (const membership of memberships) {
				let listMemberships = membershipsByListId.get(membership.userListId);
				if (listMemberships == null) membershipsByListId.set(membership.userListId, listMemberships = []);
				listMemberships.push(membership);
				let userListIds = listIdsByUserId.get(membership.userId);
				if (userListIds == null) listIdsByUserId.set(membership.userId, userListIds = new Set());
				userListIds.add(membership.userListId);
			}
			const memberUserIds = [...listIdsByUserId.keys()];
			const memberUsers: MiUser[] = memberUserIds.length > 0
				? await this.usersRepository.findBy({ id: In(memberUserIds) }) as MiUser[]
				: [];
			const usersByListId = new Map<string, MiUser[]>();
			for (const memberUser of memberUsers) {
				for (const listId of listIdsByUserId.get(memberUser.id) ?? []) {
					let listUsers = usersByListId.get(listId);
					if (listUsers == null) usersByListId.set(listId, listUsers = []);
					listUsers.push(memberUser);
				}
			}

			for (const list of lists) {
				const listMemberships = membershipsByListId.get(list.id) ?? [];
				const users = usersByListId.get(list.id) ?? [];
				const usersWithReplies = new Set(listMemberships.filter(m => m.withReplies).map(m => m.userId));
				const lines: string[] = [];

				for (const u of users) {
					const acct = this.utilityService.getFullApAccount(u.username, u.host);
					// 3rd column and later will be key=value pairs
					lines.push(`${list.name},${acct},withReplies=${usersWithReplies.has(u.id)}`);
				}
				if (lines.length > 0) {
					await new Promise<void>((res, rej) => {
						stream.write(lines.join('\n') + '\n', err => {
							if (err) {
								this.logger.error(err);
								rej(err);
							} else {
								res();
							}
						});
					});
				}
			}

			stream.end();
			this.logger.succ(`Exported to: ${path}`);

			const fileName = 'user-lists-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'csv' });

			this.logger.succ(`Exported to: ${driveFile.id}`);

			this.notificationService.createNotification(user.id, 'exportCompleted', {
				exportedEntity: 'userList',
				fileId: driveFile.id,
			});
		} finally {
			cleanup();
		}
	}
}
