/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import type { NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { RecommendationTimelineService } from '@/core/RecommendationTimelineService.js';
import { MiLocalUser } from '@/models/User.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},

	errors: {
		gtlDisabled: {
			message: 'Global timeline has been disabled.',
			code: 'GTL_DISABLED',
			id: '0332fc13-6ab2-4427-ae80-a9fadffd1a6b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		withFiles: { type: 'boolean', default: false },
		withRenotes: { type: 'boolean', default: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
		private roleService: RoleService,
		private activeUsersChart: ActiveUsersChart,
		private recommendationTimelineService: RecommendationTimelineService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me ? me.id : null);
			if (!policies.gtlAvailable) {
				throw new ApiError(meta.errors.gtlDisabled);
			}
			const enableDiscovery = ps.sinceId == null && ps.untilId == null && ps.sinceDate == null && ps.untilDate == null;
			const loadRecommendedCandidates = async (candidateIds: string[]) => {
				const candidates = await this.getFromDb({
					sinceId: null,
					untilId: null,
					sinceDate: null,
					untilDate: null,
					limit: candidateIds.length,
					withFiles: ps.withFiles,
					withRenotes: ps.withRenotes,
					candidateIds,
				}, me);
				return await this.noteEntityService.packMany(candidates, me);
			};

			const timeline = await this.getFromDb({
				sinceId: ps.sinceId ?? null,
				untilId: ps.untilId ?? null,
				sinceDate: ps.sinceDate ?? null,
				untilDate: ps.untilDate ?? null,
				limit: ps.limit,
				withFiles: ps.withFiles,
				withRenotes: ps.withRenotes,
			}, me);

			process.nextTick(() => {
				if (me) {
					this.activeUsersChart.read(me);
				}
			});

			const packed = await this.noteEntityService.packMany(timeline, me);
			return await this.recommendationTimelineService.mix(packed, me?.id ?? null, {
				limit: ps.limit,
				enableDiscovery,
				loadCandidates: loadRecommendedCandidates,
			});
		});
	}

	private async getFromDb(ps: {
		sinceId: string | null,
		untilId: string | null,
		sinceDate: number | null,
		untilDate: number | null,
		limit: number,
		withFiles: boolean,
		withRenotes: boolean,
		candidateIds?: string[],
	}, me: MiLocalUser | null) {
			const query = this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'),
				ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
				.andWhere('note.visibility = \'public\'')
				.andWhere('note.channelId IS NULL')
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (ps.candidateIds != null) {
				if (ps.candidateIds.length === 0) return [];
				query.andWhere('note.id IN (:...candidateIds)', { candidateIds: ps.candidateIds });
			}

			this.queryService.generateBaseNoteFilteringQuery(query, me);
			if (me) this.queryService.generateMutedUserRenotesQueryForNotes(query, me);

			if (ps.withFiles) {
				query.andWhere('note.fileIds != \'{}\'');
			}

			if (!ps.withRenotes) {
				query.andWhere(new Brackets(qb => {
					qb.where('note.renoteId IS NULL');
					qb.orWhere(new Brackets(qb => {
						qb.where('note.text IS NOT NULL');
						qb.orWhere('note.fileIds != \'{}\'');
						qb.orWhere('0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)');
					}));
				}));
			}
			return await query.limit(ps.limit).getMany();
	}
}
