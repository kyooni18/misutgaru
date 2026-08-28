/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { runtimeDiagnostics } from '@/misc/runtime-diagnostics.js';

export const meta = {
	requireCredential: true,
	requireModerator: true,
	kind: 'read:admin:server-info',
	tags: ['admin', 'meta'],
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			startedAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
			uptimeMs: { type: 'number', optional: false, nullable: false },
			process: {
				type: 'object', optional: false, nullable: false,
				properties: {
					rssBytes: { type: 'number', optional: false, nullable: false },
					heapUsedBytes: { type: 'number', optional: false, nullable: false },
					heapTotalBytes: { type: 'number', optional: false, nullable: false },
					externalBytes: { type: 'number', optional: false, nullable: false },
					eventLoopUtilization: { type: 'number', optional: false, nullable: false },
					eventLoopDelay: {
						type: 'object', optional: false, nullable: false,
						properties: {
							p50Ms: { type: 'number', optional: false, nullable: false },
							p95Ms: { type: 'number', optional: false, nullable: false },
							p99Ms: { type: 'number', optional: false, nullable: false },
							maxMs: { type: 'number', optional: false, nullable: false },
						},
						required: ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs'],
					},
				},
				required: ['rssBytes', 'heapUsedBytes', 'heapTotalBytes', 'externalBytes', 'eventLoopUtilization', 'eventLoopDelay'],
			},
			counters: {
				type: 'array', optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						name: { type: 'string', optional: false, nullable: false },
						value: { type: 'number', optional: false, nullable: false },
					},
					required: ['name', 'value'],
				},
			},
			distributions: {
				type: 'array', optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						name: { type: 'string', optional: false, nullable: false },
						count: { type: 'number', optional: false, nullable: false },
						sum: { type: 'number', optional: false, nullable: false },
						min: { type: 'number', optional: false, nullable: false },
						max: { type: 'number', optional: false, nullable: false },
						average: { type: 'number', optional: false, nullable: false },
						p50: { type: 'number', optional: false, nullable: false },
						p95: { type: 'number', optional: false, nullable: false },
						p99: { type: 'number', optional: false, nullable: false },
					},
					required: ['name', 'count', 'sum', 'min', 'max', 'average', 'p50', 'p95', 'p99'],
				},
			},
			recentTraces: {
				type: 'array', optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						at: { type: 'string', optional: false, nullable: false, format: 'date-time' },
						category: { type: 'string', optional: false, nullable: false },
						durationMs: { type: 'number', optional: false, nullable: false },
						detail: { type: 'object', optional: true, nullable: false, additionalProperties: true },
					},
					required: ['at', 'category', 'durationMs'],
				},
			},
		},
		required: ['startedAt', 'uptimeMs', 'process', 'counters', 'distributions', 'recentTraces'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor() {
		super(meta, paramDef, async () => {
			const snapshot = runtimeDiagnostics.snapshot();
			return {
				startedAt: snapshot.startedAt,
				uptimeMs: snapshot.uptimeMs,
				process: snapshot.process,
				counters: Object.entries(snapshot.counters).map(([name, value]) => ({ name, value })),
				distributions: Object.entries(snapshot.distributions).map(([name, value]) => ({ name, ...value })),
				recentTraces: snapshot.recentTraces,
			};
		});
	}
}
