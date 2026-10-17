/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { UserProfilesRepository, UserSecurityKeysRepository } from '@/models/_.js';
import { WebAuthnService } from '@/core/WebAuthnService.js';
import { ApiError } from '@/server/api/error.js';
import { UserAuthService } from '@/core/UserAuthService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

export const meta = {
	requireCredential: true,

	secure: true,

	errors: {
		incorrectPassword: {
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: '0d7ec6d2-e652-443e-a7bf-9ee9a0cd77b0',
		},

		incorrectToken: {
			message: 'Incorrect two-factor authentication code.',
			code: 'INCORRECT_TOKEN',
			id: 'a9c2a5b5-0a4e-4a8d-9a3e-6f1f6c2a7d41',
		},

		registrationExpired: {
			message: 'Security key registration expired. Please start again.',
			code: 'REGISTRATION_EXPIRED',
			id: 'c3e1f0a2-4b7d-4e8a-9f2c-1d5b6a7e8f90',
		},

		verificationFailed: {
			message: 'Security key verification failed.',
			code: 'VERIFICATION_FAILED',
			id: 'e4b2d1c3-5a6f-4b7e-8c9d-0a1b2c3d4e5f',
		},

		twoFactorNotEnabled: {
			message: '2fa not enabled.',
			code: 'TWO_FACTOR_NOT_ENABLED',
			id: '798d6847-b1ed-4f9c-b1f9-163c42655995',
		},
	},

	res: {
		type: 'object',
		nullable: false,
		optional: false,
		properties: {
			id: { type: 'string' },
			name: { type: 'string' },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		password: { type: 'string' },
		token: { type: 'string', nullable: true },
		name: { type: 'string', minLength: 1, maxLength: 30 },
		credential: { type: 'object' },
	},
	required: ['password', 'name', 'credential'],
} as const;

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.userSecurityKeysRepository)
		private userSecurityKeysRepository: UserSecurityKeysRepository,

		private webAuthnService: WebAuthnService,
		private userAuthService: UserAuthService,
		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
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

			const passwordMatched = await bcrypt.compare(ps.password, profile.password ?? '');
			if (!passwordMatched) {
				throw new ApiError(meta.errors.incorrectPassword);
			}

			if (!profile.twoFactorEnabled) {
				throw new ApiError(meta.errors.twoFactorNotEnabled);
			}

			let keyInfo;
			try {
				keyInfo = await this.webAuthnService.verifyRegistration(me.id, ps.credential);
			} catch (err) {
				if (err instanceof IdentifiableError && err.id === '7dbfb66c-9216-4e2b-9c27-cef2ac8efb84') {
					throw new ApiError(meta.errors.registrationExpired);
				}
				throw new ApiError(meta.errors.verificationFailed);
			}
			const keyId = keyInfo.credentialID;

			await this.userSecurityKeysRepository.insert({
				id: keyId,
				userId: me.id,
				name: ps.name,
				publicKey: Buffer.from(keyInfo.credentialPublicKey).toString('base64url'),
				counter: keyInfo.counter,
				credentialDeviceType: keyInfo.credentialDeviceType,
				credentialBackedUp: keyInfo.credentialBackedUp,
				transports: keyInfo.transports,
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(me.id, 'meUpdated', await this.userEntityService.pack(me.id, me, {
				schema: 'MeDetailed',
				includeSecrets: true,
			}));

			return {
				id: keyId,
				name: ps.name,
			};
		});
	}
}
