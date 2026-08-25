/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In, MoreThan } from 'typeorm';
import { format as dateFormat } from 'date-fns';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, BlockingsRepository, MiBlocking } from '@/models/_.js';
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
export class ExportBlockingProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		private utilityService: UtilityService,
		private notificationService: NotificationService,
		private driveService: DriveService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-blocking');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting blocking of ${job.data.user.id} ...`);

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
			let cursor: MiBlocking['id'] | null = null;

			const total = await this.blockingsRepository.countBy({
				blockerId: user.id,
			});

			while (true) {
				const blockings = await this.blockingsRepository.find({
					where: {
						blockerId: user.id,
						...(cursor ? { id: MoreThan(cursor) } : {}),
					},
					take: 100,
					order: {
						id: 1,
					},
				}) as MiBlocking[];

				if (blockings.length === 0) {
					job.updateProgress(100);
					break;
				}

				cursor = blockings.at(-1)?.id ?? null;

				const blockeeIds = [...new Set(blockings.map(block => block.blockeeId))];
				const blockees: MiUser[] = blockeeIds.length === 0 ? [] : await this.usersRepository.findBy({ id: In(blockeeIds) }) as MiUser[];
				const blockeesById = new Map(blockees.map(blockee => [blockee.id, blockee]));
				const lines: string[] = [];
				for (const block of blockings) {
					const u = blockeesById.get(block.blockeeId);
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

			const fileName = 'blocking-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'csv' });

			this.logger.succ(`Exported to: ${driveFile.id}`);

			this.notificationService.createNotification(user.id, 'exportCompleted', {
				exportedEntity: 'blocking',
				fileId: driveFile.id,
			});
		} finally {
			cleanup();
		}
	}
}
