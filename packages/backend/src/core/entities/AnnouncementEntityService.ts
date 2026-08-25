/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository, AnnouncementReadsRepository, MiAnnouncement, MiUser } from '@/models/_.js';

type PackableAnnouncement = MiAnnouncement & { isRead?: boolean | null };
import type { Packed } from '@/misc/json-schema.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';

@Injectable()
export class AnnouncementEntityService {
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		@Inject(DI.announcementReadsRepository)
		private announcementReadsRepository: AnnouncementReadsRepository,

		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(
		src: MiAnnouncement['id'] | PackableAnnouncement,
		me?: { id: MiUser['id'] } | null | undefined,
		hint?: { isRead?: boolean },
	): Promise<Packed<'Announcement'>> {
		const announcement = typeof src === 'object'
			? src
			: await this.announcementsRepository.findOneByOrFail({
				id: src,
			}) as MiAnnouncement & { isRead?: boolean | null };

		if (me && announcement.isRead === undefined) {
			announcement.isRead = hint?.isRead ?? await this.announcementReadsRepository
				.countBy({
					announcementId: announcement.id,
					userId: me.id,
				})
				.then((count: number) => count > 0);
		}

		return {
			id: announcement.id,
			createdAt: this.idService.parse(announcement.id).date.toISOString(),
			updatedAt: announcement.updatedAt?.toISOString() ?? null,
			title: announcement.title,
			text: announcement.text,
			imageUrl: announcement.imageUrl,
			icon: announcement.icon,
			display: announcement.display,
			forYou: announcement.userId === me?.id,
			needConfirmationToRead: announcement.needConfirmationToRead,
			silence: announcement.silence,
			isRead: announcement.isRead !== null ? announcement.isRead : undefined,
		};
	}

	@bindThis
	public async packMany(
		announcements: (MiAnnouncement['id'] | PackableAnnouncement)[],
		me?: { id: MiUser['id'] } | null | undefined,
	) : Promise<Packed<'Announcement'>[]> {
		let readIds: Set<MiAnnouncement['id']> | null = null;
		if (me) {
			const objectIds = [...new Set(announcements
				.filter((announcement): announcement is PackableAnnouncement => typeof announcement === 'object' && announcement.isRead === undefined)
				.map(announcement => announcement.id))];
			if (objectIds.length > 0) {
				const rows = await this.announcementReadsRepository.createQueryBuilder('read')
					.select('read.announcementId', 'announcementId')
					.where('read.userId = :userId', { userId: me.id })
					.andWhere('read.announcementId IN (:...announcementIds)', { announcementIds: objectIds })
					.getRawMany<{ announcementId: MiAnnouncement['id'] }>();
				readIds = new Set((rows as { announcementId: MiAnnouncement['id'] }[]).map(row => row.announcementId));
			}
		}

		return (await Promise.allSettled(announcements.map(x => this.pack(
			x,
			me,
			typeof x === 'object' && x.isRead === undefined && readIds != null ? { isRead: readIds.has(x.id) } : undefined,
		))))
			.filter(result => result.status === 'fulfilled')
			.map(result => (result as PromiseFulfilledResult<Packed<'Announcement'>>).value);
	}
}
