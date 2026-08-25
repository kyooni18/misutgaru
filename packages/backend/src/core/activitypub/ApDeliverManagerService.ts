/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { FollowingsRepository } from '@/models/_.js';
import type { MiLocalUser, MiRemoteUser, MiUser } from '@/models/User.js';
import { QueueService } from '@/core/QueueService.js';
import { bindThis } from '@/decorators.js';
import type { IActivity } from '@/core/activitypub/type.js';
import { ThinUser } from '@/queue/types.js';

class DeliverManager {
	private actor: ThinUser;
	private activity: IActivity | null;
	private hasFollowersRecipe = false;
	private directRecipients: MiRemoteUser[] = [];

	/**
	 * Constructor
	 * @param followingsRepository
	 * @param queueService
	 * @param actor Actor
	 * @param activity Activity to deliver
	 */
	constructor(
		private followingsRepository: FollowingsRepository,
		private queueService: QueueService,

		actor: { id: MiUser['id']; host: null; },
		activity: IActivity | null,
	) {
		// 型で弾いてはいるが一応ローカルユーザーかチェック
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (actor.host != null) throw new Error('actor.host must be null');

		// パフォーマンス向上のためキューに突っ込むのはidのみに絞る
		this.actor = {
			id: actor.id,
		};
		this.activity = activity;
	}

	/**
	 * Add recipe for followers deliver
	 */
	@bindThis
	public addFollowersRecipe(): void {
		this.hasFollowersRecipe = true;
	}

	/**
	 * Add recipe for direct deliver
	 * @param to To
	 */
	@bindThis
	public addDirectRecipe(to: MiRemoteUser): void {
		this.directRecipients.push(to);
	}

	/**
	 * Execute delivers
	 */
	@bindThis
	public async execute(): Promise<void> {
		// The value flags whether it is shared or not.
		// key: inbox URL, value: whether it is sharedInbox
		const inboxes = new Map<string, boolean>();

		// build inbox list
		// Process follower recipes first to avoid duplication when processing direct recipes later.
		if (this.hasFollowersRecipe) {
			// Collapse followers that share an ActivityPub inbox in PostgreSQL instead
			// of materializing one JS object per remote follower. Large instances often
			// have thousands of followers behind only a handful of shared inboxes.
			const followerInboxes = await this.followingsRepository.createQueryBuilder('following')
				.select('COALESCE(following.followerSharedInbox, following.followerInbox)', 'inbox')
				.addSelect('BOOL_OR(following.followerSharedInbox IS NOT NULL)', 'isSharedInbox')
				.where('following.followeeId = :followeeId', { followeeId: this.actor.id })
				.andWhere('following.followerHost IS NOT NULL')
				.groupBy('COALESCE(following.followerSharedInbox, following.followerInbox)')
				.getRawMany<{ inbox: string | null; isSharedInbox: boolean }>();

			for (const row of followerInboxes) {
				if (row.inbox === null) throw new Error('inbox is null');
				inboxes.set(row.inbox, row.isSharedInbox);
			}
		}

		for (const to of this.directRecipients) {
			// check that shared inbox has not been added yet
			if (to.sharedInbox !== null && inboxes.has(to.sharedInbox)) continue;

			// check that they actually have an inbox
			if (to.inbox === null) continue;

			inboxes.set(to.inbox, false);
		}

		// deliver
		await this.queueService.deliverMany(this.actor, this.activity, inboxes);
	}
}

@Injectable()
export class ApDeliverManagerService {
	constructor(
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private queueService: QueueService,
	) {
	}

	/**
	 * Deliver activity to followers
	 * @param actor
	 * @param activity Activity
	 */
	@bindThis
	public async deliverToFollowers(actor: { id: MiLocalUser['id']; host: null; }, activity: IActivity): Promise<void> {
		const manager = new DeliverManager(
			this.followingsRepository,
			this.queueService,
			actor,
			activity,
		);
		manager.addFollowersRecipe();
		await manager.execute();
	}

	/**
	 * Deliver activity to user
	 * @param actor
	 * @param activity Activity
	 * @param to Target user
	 */
	@bindThis
	public async deliverToUser(actor: { id: MiLocalUser['id']; host: null; }, activity: IActivity, to: MiRemoteUser): Promise<void> {
		const manager = new DeliverManager(
			this.followingsRepository,
			this.queueService,
			actor,
			activity,
		);
		manager.addDirectRecipe(to);
		await manager.execute();
	}

	/**
	 * Deliver activity to users
	 * @param actor
	 * @param activity Activity
	 * @param targets Target users
	 */
	@bindThis
	public async deliverToUsers(actor: { id: MiLocalUser['id']; host: null; }, activity: IActivity, targets: MiRemoteUser[]): Promise<void> {
		const manager = new DeliverManager(
			this.followingsRepository,
			this.queueService,
			actor,
			activity,
		);
		for (const to of targets) manager.addDirectRecipe(to);
		await manager.execute();
	}

	@bindThis
	public createDeliverManager(actor: { id: MiUser['id']; host: null; }, activity: IActivity | null): DeliverManager {
		return new DeliverManager(
			this.followingsRepository,
			this.queueService,

			actor,
			activity,
		);
	}
}
