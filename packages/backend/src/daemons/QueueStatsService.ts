/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Xev from 'xev';
import * as Bull from 'bullmq';
import { QueueService } from '@/core/QueueService.js';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { QUEUE, baseQueueOptions } from '@/queue/const.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const ev = new Xev();

@Injectable()
export class QueueStatsService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timeout | null = null;
	private deliverQueueEvents: Bull.QueueEvents | null = null;
	private inboxQueueEvents: Bull.QueueEvents | null = null;
	private watcherCount = 0;
	private started = false;
	private tickRunning = false;
	private activeDeliverJobs = 0;
	private activeInboxJobs = 0;
	private readonly log: any[] = [];

	constructor(
		@Inject(DI.config)
		private config: Config,

		private queueService: QueueService,
	) {
	}

	/** Register demand signals. Sampling starts only while a stats channel exists. */
	@bindThis
	public start(): void {
		if (this.started) return;
		this.started = true;
		ev.on('queueStats:subscribe', this.onSubscribe);
		ev.on('queueStats:unsubscribe', this.onUnsubscribe);
		ev.on('requestQueueStatsLog', this.onRequestLog);
	}

	@bindThis
	private onSubscribe(): void {
		this.watcherCount++;
		if (this.watcherCount === 1) this.startSampling();
	}

	@bindThis
	private onUnsubscribe(): void {
		this.watcherCount = Math.max(0, this.watcherCount - 1);
		if (this.watcherCount === 0) void this.stopSampling();
	}

	@bindThis
	private onRequestLog(x: { id: string; length?: number }): void {
		ev.emit(`queueStatsLog:${x.id}`, this.log.slice(0, x.length ?? 50));
	}

	@bindThis
	private onDeliverActive(): void {
		this.activeDeliverJobs++;
	}

	@bindThis
	private onInboxActive(): void {
		this.activeInboxJobs++;
	}

	private startSampling(): void {
		if (this.intervalId != null) return;

		this.deliverQueueEvents = new Bull.QueueEvents(QUEUE.DELIVER, baseQueueOptions(this.config, QUEUE.DELIVER));
		this.inboxQueueEvents = new Bull.QueueEvents(QUEUE.INBOX, baseQueueOptions(this.config, QUEUE.INBOX));
		this.deliverQueueEvents.on('active', this.onDeliverActive);
		this.inboxQueueEvents.on('active', this.onInboxActive);

		void this.tick();
		this.intervalId = setInterval(() => void this.tick(), 10_000);
	}

	@bindThis
	private async tick(): Promise<void> {
		if (this.tickRunning || this.watcherCount === 0) return;
		this.tickRunning = true;
		try {
			const [deliverJobCounts, inboxJobCounts] = await Promise.all([
				this.queueService.deliverQueue.getJobCounts('active', 'waiting', 'delayed'),
				this.queueService.inboxQueue.getJobCounts('active', 'waiting', 'delayed'),
			]);

			const stats = {
				deliver: {
					activeSincePrevTick: this.activeDeliverJobs,
					active: deliverJobCounts.active,
					waiting: deliverJobCounts.waiting,
					delayed: deliverJobCounts.delayed,
				},
				inbox: {
					activeSincePrevTick: this.activeInboxJobs,
					active: inboxJobCounts.active,
					waiting: inboxJobCounts.waiting,
					delayed: inboxJobCounts.delayed,
				},
			};

			ev.emit('queueStats', stats);
			this.log.unshift(stats);
			if (this.log.length > 200) this.log.pop();
			this.activeDeliverJobs = 0;
			this.activeInboxJobs = 0;
		} finally {
			this.tickRunning = false;
		}
	}

	private async stopSampling(): Promise<void> {
		if (this.intervalId != null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		const deliverQueueEvents = this.deliverQueueEvents;
		const inboxQueueEvents = this.inboxQueueEvents;
		this.deliverQueueEvents = null;
		this.inboxQueueEvents = null;
		this.activeDeliverJobs = 0;
		this.activeInboxJobs = 0;
		this.log.length = 0;

		await Promise.all([
			deliverQueueEvents?.close(),
			inboxQueueEvents?.close(),
		]);
	}

	@bindThis
	public async dispose(): Promise<void> {
		if (this.started) {
			ev.removeListener('queueStats:subscribe', this.onSubscribe);
			ev.removeListener('queueStats:unsubscribe', this.onUnsubscribe);
			ev.removeListener('requestQueueStatsLog', this.onRequestLog);
			this.started = false;
		}
		this.watcherCount = 0;
		await this.stopSampling();
	}

	@bindThis
	public async onApplicationShutdown(signal?: string | undefined): Promise<void> {
		await this.dispose();
	}
}
