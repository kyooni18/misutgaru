/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { GalleryLikesRepository, GalleryPostsRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import type { MiUser } from '@/models/User.js';
import type { MiGalleryPost } from '@/models/GalleryPost.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';

@Injectable()
export class GalleryPostEntityService {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		@Inject(DI.galleryLikesRepository)
		private galleryLikesRepository: GalleryLikesRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(
		src: MiGalleryPost['id'] | MiGalleryPost,
		me?: { id: MiUser['id'] } | null | undefined,
		hint?: {
			packedUser?: Packed<'UserLite'>;
			packedFiles?: Map<string, Packed<'DriveFile'> | null>;
			isLiked?: boolean;
		},
	): Promise<Packed<'GalleryPost'>> {
		const meId = me ? me.id : null;
		const post = typeof src === 'object' ? src : await this.galleryPostsRepository.findOneByOrFail({ id: src });

		return await awaitAll({
			id: post.id,
			createdAt: this.idService.parse(post.id).date.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
			userId: post.userId,
			user: hint?.packedUser ?? this.userEntityService.pack(post.user ?? post.userId, me),
			title: post.title,
			description: post.description,
			fileIds: post.fileIds,
			files: hint?.packedFiles
				? post.fileIds.map((id: string) => hint.packedFiles!.get(id)).filter((file: Packed<'DriveFile'> | null | undefined): file is Packed<'DriveFile'> => file != null)
				: this.driveFileEntityService.packManyByIds(post.fileIds),
			tags: post.tags.length > 0 ? post.tags : undefined,
			isSensitive: post.isSensitive,
			likedCount: post.likedCount,
			isLiked: meId ? (hint?.isLiked ?? await this.galleryLikesRepository.exists({ where: { postId: post.id, userId: meId } })) : undefined,
		});
	}

	@bindThis
	public async packMany(
		posts: MiGalleryPost[],
		me?: { id: MiUser['id'] } | null | undefined,
	) {
		if (posts.length === 0) return [];

		const usersById = new Map<MiUser['id'], MiUser | MiUser['id']>();
		const fileIds = new Set<string>();
		for (const post of posts) {
			const user = post.user ?? post.userId;
			const existing = usersById.get(post.userId);
			if (existing == null || typeof user === 'object') usersById.set(post.userId, user);
			for (const fileId of post.fileIds) fileIds.add(fileId);
		}

		const meId = me?.id ?? null;
		const [packedUsers, packedFiles, likes] = await Promise.all([
			this.userEntityService.packMany([...usersById.values()], me),
			fileIds.size > 0 ? this.driveFileEntityService.packManyByIdsMap([...fileIds]) : Promise.resolve(new Map()),
			meId ? this.galleryLikesRepository.createQueryBuilder('like')
				.select('like.postId', 'postId')
				.where('like.userId = :userId', { userId: meId })
				.andWhere('like.postId IN (:...postIds)', { postIds: [...new Set(posts.map(post => post.id))] })
				.getRawMany<{ postId: MiGalleryPost['id'] }>() : Promise.resolve([]),
		]);
		const userMap = new Map<MiUser['id'], Packed<'UserLite'>>();
		for (const user of packedUsers as Packed<'UserLite'>[]) userMap.set(user.id, user);
		const likedPostIds = new Set((likes as { postId: MiGalleryPost['id'] }[]).map(like => like.postId));

		return Promise.all(posts.map(post => this.pack(post, me, {
			packedUser: userMap.get(post.userId),
			packedFiles,
			isLiked: meId ? likedPostIds.has(post.id) : undefined,
		})));
	}
}

