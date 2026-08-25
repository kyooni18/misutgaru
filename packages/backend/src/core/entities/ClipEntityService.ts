/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ClipNotesRepository, ClipFavoritesRepository, ClipsRepository, MiUser } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import type { MiClip } from '@/models/Clip.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './UserEntityService.js';

@Injectable()
export class ClipEntityService {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,

		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,

		private userEntityService: UserEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(
		src: MiClip['id'] | MiClip,
		me?: { id: MiUser['id'] } | null | undefined,
		hint?: {
			packedUser?: Packed<'UserLite'>;
			favoritedCount?: number;
			isFavorited?: boolean;
			notesCount?: number;
		},
	): Promise<Packed<'Clip'>> {
		const meId = me ? me.id : null;
		const clip = typeof src === 'object' ? src : await this.clipsRepository.findOneByOrFail({ id: src });

		return await awaitAll({
			id: clip.id,
			createdAt: this.idService.parse(clip.id).date.toISOString(),
			lastClippedAt: clip.lastClippedAt ? clip.lastClippedAt.toISOString() : null,
			userId: clip.userId,
			user: hint?.packedUser ?? this.userEntityService.pack(clip.user ?? clip.userId),
			name: clip.name,
			description: clip.description,
			isPublic: clip.isPublic,
			favoritedCount: hint?.favoritedCount ?? await this.clipFavoritesRepository.countBy({ clipId: clip.id }),
			isFavorited: meId ? (hint?.isFavorited ?? await this.clipFavoritesRepository.exists({ where: { clipId: clip.id, userId: meId } })) : undefined,
			notesCount: (meId === clip.userId) ? (hint?.notesCount ?? await this.clipNotesRepository.countBy({ clipId: clip.id })) : undefined,
		});
	}

	@bindThis
	public async packMany(
		clips: MiClip[],
		me?: { id: MiUser['id'] } | null | undefined,
	) {
		if (clips.length === 0) return [];

		const clipIds = [...new Set(clips.map(clip => clip.id))];
		const ownedClipIds = me ? [...new Set(clips.filter(clip => clip.userId === me.id).map(clip => clip.id))] : [];
		const [packedUsers, favoriteCounts, myFavorites, noteCounts] = await Promise.all([
			this.userEntityService.packMany(clips.map(({ user, userId }) => user ?? userId), me),
			this.clipFavoritesRepository.createQueryBuilder('favorite')
				.select('favorite.clipId', 'clipId')
				.addSelect('COUNT(*)', 'count')
				.where('favorite.clipId IN (:...clipIds)', { clipIds })
				.groupBy('favorite.clipId')
				.getRawMany<{ clipId: MiClip['id']; count: string }>(),
			me
				? this.clipFavoritesRepository.createQueryBuilder('favorite')
					.select('favorite.clipId', 'clipId')
					.where('favorite.userId = :userId', { userId: me.id })
					.andWhere('favorite.clipId IN (:...clipIds)', { clipIds })
					.getRawMany<{ clipId: MiClip['id'] }>()
				: Promise.resolve([]),
			ownedClipIds.length > 0
				? this.clipNotesRepository.createQueryBuilder('clipNote')
					.select('clipNote.clipId', 'clipId')
					.addSelect('COUNT(*)', 'count')
					.where('clipNote.clipId IN (:...clipIds)', { clipIds: ownedClipIds })
					.groupBy('clipNote.clipId')
					.getRawMany<{ clipId: MiClip['id']; count: string }>()
				: Promise.resolve([]),
		]);

		const userMap = new Map<MiUser['id'], Packed<'UserLite'>>();
		for (const user of packedUsers as Packed<'UserLite'>[]) userMap.set(user.id, user);
		const favoriteCountMap = new Map<MiClip['id'], number>();
		for (const row of favoriteCounts as { clipId: MiClip['id']; count: string }[]) favoriteCountMap.set(row.clipId, Number(row.count));
		const myFavoriteSet = new Set<MiClip['id']>();
		for (const row of myFavorites as { clipId: MiClip['id'] }[]) myFavoriteSet.add(row.clipId);
		const noteCountMap = new Map<MiClip['id'], number>();
		for (const row of noteCounts as { clipId: MiClip['id']; count: string }[]) noteCountMap.set(row.clipId, Number(row.count));

		return Promise.all(clips.map(clip => this.pack(clip, me, {
			packedUser: userMap.get(clip.userId),
			favoritedCount: favoriteCountMap.get(clip.id) ?? 0,
			isFavorited: me ? myFavoriteSet.has(clip.id) : undefined,
			notesCount: me?.id === clip.userId ? (noteCountMap.get(clip.id) ?? 0) : undefined,
		})));
	}
}

