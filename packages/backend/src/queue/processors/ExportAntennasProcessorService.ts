/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { format as DateFormat } from 'date-fns';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { AntennasRepository, UsersRepository, UserListMembershipsRepository, MiAntenna, MiUser, MiUserListMembership } from '@/models/_.js';
import Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ExportedAntenna } from '@/queue/processors/ImportAntennasProcessorService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { DBExportAntennasData } from '../types.js';
import type * as Bull from 'bullmq';

@Injectable()
export class ExportAntennasProcessorService {
	private logger: Logger;

	constructor (
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.antennasRepository)
		private antennsRepository: AntennasRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		private driveService: DriveService,
		private utilityService: UtilityService,
		private queueLoggerService: QueueLoggerService,
		private notificationService: NotificationService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-antennas');
	}

	@bindThis
	public async process(job: Bull.Job<DBExportAntennasData>): Promise<void> {
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}
		const [path, cleanup] = await createTemp();
		const stream = fs.createWriteStream(path, { flags: 'a' });
		const write = (input: string): Promise<void> => {
			return new Promise((resolve, reject) => {
				stream.write(input, err => {
					if (err) {
						this.logger.error(err);
						reject();
					} else {
						resolve();
					}
				});
			});
		};
		try {
			const antennas: MiAntenna[] = await this.antennsRepository.findBy({ userId: job.data.user.id }) as MiAntenna[];
			const listIds = [...new Set(antennas.map((antenna: MiAntenna) => antenna.userListId).filter((id: string | null): id is string => id != null))];
			const memberships: MiUserListMembership[] = listIds.length > 0
				? await this.userListMembershipsRepository.findBy({ userListId: In(listIds) }) as MiUserListMembership[]
				: [];
			const listIdsByUserId = new Map<MiUser['id'], Set<string>>();
			for (const membership of memberships) {
				let userListIds = listIdsByUserId.get(membership.userId);
				if (userListIds == null) listIdsByUserId.set(membership.userId, userListIds = new Set());
				userListIds.add(membership.userListId);
			}
			const memberUserIds = [...listIdsByUserId.keys()];
			const memberUsers: MiUser[] = memberUserIds.length > 0
				? await this.usersRepository.findBy({ id: In(memberUserIds) }) as MiUser[]
				: [];
			const usersByListId = new Map<string, MiUser[]>();
			for (const user of memberUsers) {
				for (const listId of listIdsByUserId.get(user.id) ?? []) {
					let listUsers = usersByListId.get(listId);
					if (listUsers == null) usersByListId.set(listId, listUsers = []);
					listUsers.push(user);
				}
			}

			const exported = antennas.map((antenna: MiAntenna) => {
				const users = antenna.userListId == null ? undefined : (usersByListId.get(antenna.userListId) ?? []);
				return {
					name: antenna.name,
					src: antenna.src,
					keywords: antenna.keywords,
					excludeKeywords: antenna.excludeKeywords,
					users: antenna.users,
					userListAccts: typeof users !== 'undefined' ? users.map((u) => {
						return this.utilityService.getFullApAccount(u.username, u.host); // acct
					}) : null,
					caseSensitive: antenna.caseSensitive,
					localOnly: antenna.localOnly,
					excludeBots: antenna.excludeBots,
					withReplies: antenna.withReplies,
					withFile: antenna.withFile,
					excludeNotesInSensitiveChannel: antenna.excludeNotesInSensitiveChannel,
				} satisfies Required<ExportedAntenna>;
			});
			await write(JSON.stringify(exported));
			stream.end();

			const fileName = 'antennas-' + DateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'json' });
			this.logger.succ('Exported to: ' + driveFile.id);

			this.notificationService.createNotification(user.id, 'exportCompleted', {
				exportedEntity: 'antenna',
				fileId: driveFile.id,
			});
		} finally {
			cleanup();
		}
	}
}

