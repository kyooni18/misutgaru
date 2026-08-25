/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Module } from '@nestjs/common';
import { MainModule } from '@/MainModule.js';
import { QueueProcessorModule } from '@/queue/QueueProcessorModule.js';

/**
 * Normal runtime module.
 *
 * Keeping the HTTP server and queue processors in one Nest graph lets them
 * share GlobalModule/CoreModule singletons (DB pool, Redis clients, caches,
 * repositories, and service instances) instead of constructing a second copy
 * of the backend graph in the same process.
 */
@Module({
	imports: [
		MainModule,
		QueueProcessorModule,
	],
})
export class RuntimeModule {}
