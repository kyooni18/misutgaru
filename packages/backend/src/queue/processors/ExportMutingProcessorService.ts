/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In, IsNull, MoreThan } from 'typeorm';
import { format as dateFormat } from 'date-fns';
import { DI } from '@/di-symbols.js';
import type { MutingsRepository, UsersRepository, MiMuting } from '@/models/_.js';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import type { MiUser } from '@/models/User.js';
import { bindThis } from '@/decorators.js';
import { BufferedTextFileWriter } from '@/misc/BufferedTextFileWriter.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportMutingProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		private utilityService: UtilityService,
		private driveService: DriveService,
		private queueLoggerService: QueueLoggerService,
		private notificationService: NotificationService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-muting');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting muting of ${job.data.user.id} ...`);

		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`Temp file is ${path}`);

		try {
			const writer = new BufferedTextFileWriter(path);

			let exportedCount = 0;
			let cursor: MiMuting['id'] | null = null;

			const total = await this.mutingsRepository.countBy({
				muterId: user.id,
			});

			while (true) {
				const mutes = await this.mutingsRepository.find({
					where: {
						muterId: user.id,
						expiresAt: IsNull(),
						...(cursor ? { id: MoreThan(cursor) } : {}),
					},
					take: 100,
					order: {
						id: 1,
					},
				}) as MiMuting[];

				if (mutes.length === 0) {
					job.updateProgress(100);
					break;
				}

				cursor = mutes.at(-1)?.id ?? null;

				const muteeIds = [...new Set(mutes.map(mute => mute.muteeId))];
				const mutees: MiUser[] = muteeIds.length === 0 ? [] : await this.usersRepository.findBy({ id: In(muteeIds) }) as MiUser[];
				const muteesById = new Map(mutees.map(mutee => [mutee.id, mutee]));
				const lines: string[] = [];
				for (const mute of mutes) {
					const u = muteesById.get(mute.muteeId);
					if (u == null) {
						exportedCount++; continue;
					}

					lines.push(this.utilityService.getFullApAccount(u.username, u.host));
					exportedCount++;
				}

				if (lines.length > 0) {
					await writer.write(lines.join('\n') + '\n');
				}

				job.updateProgress(exportedCount / total * 100);
			}

			await writer.close();
			this.logger.succ(`Exported to: ${path}`);

			const fileName = 'mute-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'csv' });

			this.logger.succ(`Exported to: ${driveFile.id}`);

			this.notificationService.createNotification(user.id, 'exportCompleted', {
				exportedEntity: 'muting',
				fileId: driveFile.id,
			});
		} finally {
			cleanup();
		}
	}
}
