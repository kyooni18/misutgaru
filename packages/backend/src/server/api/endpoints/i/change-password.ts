/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { UserAuthService } from '@/core/UserAuthService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	requireCredential: true,

	secure: true,

	errors: {
		incorrectToken: {
			message: 'Incorrect two-factor authentication code.',
			code: 'INCORRECT_TOKEN',
			id: 'a9c2a5b5-0a4e-4a8d-9a3e-6f1f6c2a7d41',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		currentPassword: { type: 'string' },
		newPassword: { type: 'string', minLength: 1 },
		token: { type: 'string', nullable: true },
	},
	required: ['currentPassword', 'newPassword'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userAuthService: UserAuthService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const token = ps.token;
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });

			if (profile.twoFactorEnabled) {
				if (token == null) {
					throw new ApiError(meta.errors.incorrectToken);
				}

				try {
					await this.userAuthService.twoFactorAuthenticate(profile, token.trim());
				} catch (_) {
					throw new ApiError(meta.errors.incorrectToken);
				}
			}

			const passwordMatched = await bcrypt.compare(ps.currentPassword, profile.password!);

			if (!passwordMatched) {
				throw new Error('incorrect password');
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(ps.newPassword, salt);

			await this.userProfilesRepository.update(me.id, {
				password: hash,
			});
		});
	}
}
