/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { GlobalEvents, StreamChannels } from '@/core/GlobalEventService.js';

export type RedisStreamEnvelope = {
	channel: StreamChannels;
	message: GlobalEvents[keyof GlobalEvents]['payload'];
};

let cachedRaw: string | null = null;
let cachedParsed: RedisStreamEnvelope | null = null;
let clearScheduled = false;

/**
 * Redis pub/sub delivers the exact same string to every local `message`
 * listener synchronously. Share that parse result for the duration of the
 * current microtask so singleton services do not repeatedly parse and allocate
 * the same event object.
 */
export function parseRedisStreamEvent(data: string): RedisStreamEnvelope {
	if (cachedRaw === data && cachedParsed != null) return cachedParsed;

	const parsed = JSON.parse(data) as RedisStreamEnvelope;
	cachedRaw = data;
	cachedParsed = parsed;

	if (!clearScheduled) {
		clearScheduled = true;
		queueMicrotask(() => {
			cachedRaw = null;
			cachedParsed = null;
			clearScheduled = false;
		});
	}

	return parsed;
}
