/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AccessTokensRepository, AppsRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiApp } from '@/models/App.js';
import type { MiUser } from '@/models/User.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class AppEntityService {
	constructor(
		@Inject(DI.appsRepository)
		private appsRepository: AppsRepository,

		@Inject(DI.accessTokensRepository)
		private accessTokensRepository: AccessTokensRepository,
	) {
	}

	@bindThis
	public async pack(
		src: MiApp['id'] | MiApp,
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean,
			includeSecret?: boolean,
			includeProfileImageIds?: boolean
		},
		hint?: { isAuthorized?: boolean },
	): Promise<Packed<'App'>> {
		const opts = Object.assign({
			detail: false,
			includeSecret: false,
			includeProfileImageIds: false,
		}, options);

		const app = typeof src === 'object' ? src : await this.appsRepository.findOneByOrFail({ id: src });

		return {
			id: app.id,
			name: app.name,
			callbackUrl: app.callbackUrl,
			permission: app.permission,
			...(opts.includeSecret ? { secret: app.secret } : {}),
			...(me ? {
				isAuthorized: hint?.isAuthorized ?? await this.accessTokensRepository.countBy({
					appId: app.id,
					userId: me.id,
				}).then(count => count > 0),
			} : {}),
		};
	}

	@bindThis
	public async packMany(
		apps: MiApp[],
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean,
			includeSecret?: boolean,
			includeProfileImageIds?: boolean
		},
		hint?: { authorizedAppIds?: ReadonlySet<MiApp['id']> },
	): Promise<Packed<'App'>[]> {
		if (apps.length === 0) return [];
		let authorizedAppIds = hint?.authorizedAppIds;
		if (me && authorizedAppIds == null) {
			const appIds = [...new Set(apps.map(app => app.id))];
			const rows = await this.accessTokensRepository.createQueryBuilder('token')
				.select('token.appId', 'appId')
				.where('token.userId = :userId', { userId: me.id })
				.andWhere('token.appId IN (:...appIds)', { appIds })
				.getRawMany<{ appId: MiApp['id'] }>();
			authorizedAppIds = new Set(rows.map((row: { appId: MiApp['id'] }) => row.appId));
		}
		return Promise.all(apps.map(app => this.pack(app, me, options, {
			isAuthorized: me ? (authorizedAppIds?.has(app.id) ?? false) : undefined,
		})));
	}

}
