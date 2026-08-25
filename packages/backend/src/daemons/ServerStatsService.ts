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
import type { Config } from '@/config.js';
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

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,
	) {
	}

	/**
	 * Report server stats regularly
	 */
	@bindThis
	public async start(): Promise<void> {
		if (!this.meta.enableServerMachineStats) return;

		const log = [] as any[];

		ev.on('requestServerStatsLog', x => {
			ev.emit(`serverStatsLog:${x.id}`, log.slice(0, x.length));
		});

		let tickRunning = false;
		const tick = async () => {
			if (tickRunning) return;
			tickRunning = true;
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
				log.unshift(stats);
				if (log.length > 200) log.pop();
			} finally {
				tickRunning = false;
			}
		};

		tick();

		this.intervalId = setInterval(tick, this.config.lightweightMode ? 10_000 : 2_000);
	}

	@bindThis
	public dispose(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}

// CPU STAT
function cpuUsage(): Promise<number> {
	return new Promise((res, rej) => {
		osUtils.cpuUsage((cpuUsage) => {
			res(cpuUsage);
		});
	});
}
