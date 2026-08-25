/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { MiMeta, UsersRepository } from '@/models/_.js';
import * as Acct from '@/misc/acct.js';
import type { MiUser } from '@/models/User.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'UserDetailed',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const accounts = this.serverSettings.pinnedUsers.map(acct => Acct.parse(acct));
			if (accounts.length === 0) return [];

			const users = await this.usersRepository.findBy(accounts.map(acct => ({
				usernameLower: acct.username.toLowerCase(),
				host: acct.host ?? IsNull(),
			})));
			const userByAccount = new Map<string, MiUser>();
			for (const user of users as MiUser[]) {
				userByAccount.set(`${user.usernameLower}\0${user.host ?? ''}`, user);
			}
			const orderedUsers = accounts
				.map(acct => userByAccount.get(`${acct.username.toLowerCase()}\0${acct.host ?? ''}`))
				.filter((user): user is MiUser => user != null);

			return await this.userEntityService.packMany(orderedUsers, me, { schema: 'UserDetailed' });
		});
	}
}
