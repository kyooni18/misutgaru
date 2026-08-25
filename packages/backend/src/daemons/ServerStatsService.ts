/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import Xev from 'xev';
import * as osUtils from 'os-utils';
import { bindThis } from '@/decorators.js';
import { MiMeta } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const ev = new Xev();

const roundCpu = (num: number) => Math.round(num * 1000) / 1000;
const round = (num: number) => Math.round(num * 10) / 10;

let systemInformationPromise: Promise<typeof import('systeminformation')> | null = null;
function systemInformation() {
	return systemInformationPromise ??= import('systeminformation');
}

@Injectable()
export class ServerStatsService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timeout | null = null;
	private watcherCount = 0;
	private started = false;
	private tickRunning = false;
	private readonly log: any[] = [];

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,
	) {
	}

	/** Register demand signals. Machine probes run only while somebody watches them. */
	@bindThis
	public start(): void {
		if (this.started || !this.meta.enableServerMachineStats) return;
		this.started = true;
		ev.on('serverStats:subscribe', this.onSubscribe);
		ev.on('serverStats:unsubscribe', this.onUnsubscribe);
		ev.on('requestServerStatsLog', this.onRequestLog);
	}

	@bindThis
	private onSubscribe(): void {
		this.watcherCount++;
		if (this.watcherCount === 1) this.startSampling();
	}

	@bindThis
	private onUnsubscribe(): void {
		this.watcherCount = Math.max(0, this.watcherCount - 1);
		if (this.watcherCount === 0) this.stopSampling();
	}

	@bindThis
	private onRequestLog(x: { id: string; length: number }): void {
		ev.emit(`serverStatsLog:${x.id}`, this.log.slice(0, x.length));
	}

	private startSampling(): void {
		if (this.intervalId != null) return;
		void this.tick();
		this.intervalId = setInterval(() => void this.tick(), 2_000);
	}

	@bindThis
	private async tick(): Promise<void> {
		if (this.tickRunning || this.watcherCount === 0) return;
		this.tickRunning = true;
		try {
			const si = await systemInformation();
			const [cpu, memStats, iface, fsStats] = await Promise.all([
				cpuUsage(),
				si.mem(),
				si.networkInterfaceDefault(),
				si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0 })),
			]);
			const netStats = (await si.networkStats(iface))[0];

			const stats = {
				cpu: roundCpu(cpu),
				mem: {
					used: round(memStats.total - memStats.available),
					active: round(memStats.active),
				},
				net: {
					rx: round(Math.max(0, netStats.rx_sec)),
					tx: round(Math.max(0, netStats.tx_sec)),
				},
				fs: {
					r: round(Math.max(0, fsStats.rIO_sec ?? 0)),
					w: round(Math.max(0, fsStats.wIO_sec ?? 0)),
				},
			};
			ev.emit('serverStats', stats);
			this.log.unshift(stats);
			if (this.log.length > 200) this.log.pop();
		} finally {
			this.tickRunning = false;
		}
	}

	private stopSampling(): void {
		if (this.intervalId != null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.log.length = 0;
	}

	@bindThis
	public dispose(): void {
		if (this.started) {
			ev.removeListener('serverStats:subscribe', this.onSubscribe);
			ev.removeListener('serverStats:unsubscribe', this.onUnsubscribe);
			ev.removeListener('requestServerStatsLog', this.onRequestLog);
			this.started = false;
		}
		this.watcherCount = 0;
		this.stopSampling();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}

function cpuUsage(): Promise<number> {
	return new Promise((res) => {
		osUtils.cpuUsage((usage) => {
			res(usage);
		});
	});
}
