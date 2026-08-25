/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository, PagesRepository, PageLikesRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import type { MiUser } from '@/models/User.js';
import type { MiPage } from '@/models/Page.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';

@Injectable()
export class PageEntityService {
	constructor(
		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		@Inject(DI.pageLikesRepository)
		private pageLikesRepository: PageLikesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(
		src: MiPage['id'] | MiPage,
		me?: { id: MiUser['id'] } | null | undefined,
		hint?: {
			packedUser?: Packed<'UserLite'>;
			attachedFiles?: Packed<'DriveFile'>[];
			eyeCatchingImage?: Packed<'DriveFile'> | null;
			isLiked?: boolean;
		},
	): Promise<Packed<'Page'>> {
		const meId = me ? me.id : null;
		const page = typeof src === 'object' ? src : await this.pagesRepository.findOneByOrFail({ id: src });

		const attachedFiles: Promise<MiDriveFile | null>[] = [];
		if (hint?.attachedFiles === undefined) {
			const collectFile = (xs: any[]) => {
				for (const x of xs) {
					if (x.type === 'image') {
						attachedFiles.push(this.driveFilesRepository.findOneBy({
							id: x.fileId,
							userId: page.userId,
						}));
					}
					if (x.children) collectFile(x.children);
				}
			};
			collectFile(page.content);
		}

		// 後方互換性のため
		let migrated = false;
		const migrate = (xs: any[]) => {
			for (const x of xs) {
				if (x.type === 'input') {
					if (x.inputType === 'text') {
						x.type = 'textInput';
					}
					if (x.inputType === 'number') {
						x.type = 'numberInput';
						if (x.default) x.default = parseInt(x.default, 10);
					}
					migrated = true;
				}
				if (x.children) {
					migrate(x.children);
				}
			}
		};
		migrate(page.content);
		if (migrated) {
			this.pagesRepository.update(page.id, {
				content: page.content,
			});
		}

		return await awaitAll({
			id: page.id,
			createdAt: this.idService.parse(page.id).date.toISOString(),
			updatedAt: page.updatedAt.toISOString(),
			userId: page.userId,
			user: hint?.packedUser ?? this.userEntityService.pack(page.user ?? page.userId, me), // { schema: 'UserDetailed' } すると無限ループするので注意
			content: page.content,
			variables: page.variables,
			title: page.title,
			name: page.name,
			summary: page.summary,
			hideTitleWhenPinned: page.hideTitleWhenPinned,
			alignCenter: page.alignCenter,
			font: page.font,
			script: page.script,
			eyeCatchingImageId: page.eyeCatchingImageId,
			eyeCatchingImage: page.eyeCatchingImageId
				? (hint && Object.hasOwn(hint, 'eyeCatchingImage') ? (hint.eyeCatchingImage ?? null) : await this.driveFileEntityService.pack(page.eyeCatchingImageId))
				: null,
			attachedFiles: hint?.attachedFiles ?? this.driveFileEntityService.packMany((await Promise.all(attachedFiles)).filter(x => x != null)),
			likedCount: page.likedCount,
			isLiked: meId ? (hint?.isLiked ?? await this.pageLikesRepository.exists({ where: { pageId: page.id, userId: meId } })) : undefined,
		});
	}

	@bindThis
	public async packMany(
		pages: MiPage[],
		me?: { id: MiUser['id'] } | null | undefined,
	) {
		if (pages.length === 0) return [];

		const users = pages.map(({ user, userId }) => user ?? userId);
		const pageImageIds = new Map<MiPage['id'], string[]>();
		const allFileIds = new Set<string>();
		const collectFileIds = (xs: any[], target: string[]) => {
			for (const x of xs) {
				if (x.type === 'image' && typeof x.fileId === 'string') {
					target.push(x.fileId);
					allFileIds.add(x.fileId);
				}
				if (x.children) collectFileIds(x.children, target);
			}
		};
		for (const page of pages) {
			const ids: string[] = [];
			collectFileIds(page.content, ids);
			pageImageIds.set(page.id, ids);
			if (page.eyeCatchingImageId) allFileIds.add(page.eyeCatchingImageId);
		}

		const meId = me?.id ?? null;
		const [packedUsers, driveFiles, likes] = await Promise.all([
			this.userEntityService.packMany(users, me),
			allFileIds.size > 0 ? this.driveFilesRepository.createQueryBuilder('file')
				.where('file.id IN (:...fileIds)', { fileIds: [...allFileIds] })
				.getMany() : Promise.resolve([]),
			meId ? this.pageLikesRepository.createQueryBuilder('like')
				.select('like.pageId', 'pageId')
				.where('like.userId = :userId', { userId: meId })
				.andWhere('like.pageId IN (:...pageIds)', { pageIds: [...new Set(pages.map(page => page.id))] })
				.getRawMany<{ pageId: MiPage['id'] }>() : Promise.resolve([]),
		]);
		const userMap = new Map<MiUser['id'], Packed<'UserLite'>>();
		for (const packedUser of packedUsers as Packed<'UserLite'>[]) userMap.set(packedUser.id, packedUser);
		const rawFilesById = new Map<MiDriveFile['id'], MiDriveFile>();
		for (const file of driveFiles as MiDriveFile[]) rawFilesById.set(file.id, file);
		const packedFileList = driveFiles.length > 0 ? await this.driveFileEntityService.packMany(driveFiles as MiDriveFile[]) : [];
		const packedFilesById = new Map(packedFileList.map(file => [file.id, file]));
		const likedPageIds = new Set<string>();
		for (const like of likes as { pageId: MiPage['id'] }[]) likedPageIds.add(like.pageId);

		return Promise.all(pages.map(page => {
			const attached = (pageImageIds.get(page.id) ?? []).map(fileId => {
				const rawFile = rawFilesById.get(fileId);
				return rawFile?.userId === page.userId ? packedFilesById.get(fileId) : undefined;
			}).filter((file): file is Packed<'DriveFile'> => file != null);
			const hint: {
				packedUser?: Packed<'UserLite'>;
				attachedFiles?: Packed<'DriveFile'>[];
				eyeCatchingImage?: Packed<'DriveFile'> | null;
				isLiked?: boolean;
			} = {
				packedUser: userMap.get(page.userId),
				attachedFiles: attached,
				isLiked: meId ? likedPageIds.has(page.id) : undefined,
			};
			if (page.eyeCatchingImageId && packedFilesById.has(page.eyeCatchingImageId)) {
				hint.eyeCatchingImage = packedFilesById.get(page.eyeCatchingImageId)!;
			}
			return this.pack(page, me, hint);
		}));
	}

	@bindThis
	public async packManyByIds(
		pageIds: MiPage['id'][],
		me?: { id: MiUser['id'] } | null | undefined,
	): Promise<Packed<'Page'>[]> {
		if (pageIds.length === 0) return [];
		const uniqueIds = [...new Set(pageIds)];
		const pages = await this.pagesRepository.createQueryBuilder('page')
			.where('page.id IN (:...pageIds)', { pageIds: uniqueIds })
			.getMany() as MiPage[];
		const pagesById = new Map<MiPage['id'], MiPage>(pages.map(page => [page.id, page]));

		// A dangling page reference historically failed through findOneByOrFail.
		// Preserve that behaviour only for the inconsistent rows while keeping the
		// normal path as one query.
		for (const pageId of uniqueIds) {
			if (pagesById.has(pageId)) continue;
			pagesById.set(pageId, await this.pagesRepository.findOneByOrFail({ id: pageId }) as MiPage);
		}

		const orderedPages = pageIds.map(pageId => pagesById.get(pageId)!);
		return this.packMany(orderedPages, me);
	}
}

