/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { MetricsTime } from 'bullmq';
import { Config } from '@/config.js';
import type * as Bull from 'bullmq';

export const QUEUE = {
	DELIVER: 'deliver',
	INBOX: 'inbox',
	SYSTEM: 'system',
	ENDED_POLL_NOTIFICATION: 'endedPollNotification',
	POST_SCHEDULED_NOTE: 'postScheduledNote',
	DB: 'db',
	RELATIONSHIP: 'relationship',
	OBJECT_STORAGE: 'objectStorage',
	USER_WEBHOOK_DELIVER: 'userWebhookDeliver',
	SYSTEM_WEBHOOK_DELIVER: 'systemWebhookDeliver',
};

export function baseQueueOptions(config: Config, queueName: typeof QUEUE[keyof typeof QUEUE], connection?: Bull.QueueOptions['connection']): Bull.QueueOptions {
	return {
		connection: connection ?? {
			...config.redisForJobQueue,
			keyPrefix: undefined,
		},
		prefix: config.redisForJobQueue.prefix ? `${config.redisForJobQueue.prefix}:queue:${queueName}` : `queue:${queueName}`,
	};
}

export function baseWorkerOptions(config: Config, queueName: typeof QUEUE[keyof typeof QUEUE], connection?: Bull.WorkerOptions['connection']): Bull.WorkerOptions {
	return {
		...baseQueueOptions(config, queueName, connection),
		metrics: {
			maxDataPoints: MetricsTime.ONE_WEEK,
		},
	};
}
