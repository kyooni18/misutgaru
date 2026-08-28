/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { monitorEventLoopDelay, performance, type IntervalHistogram } from 'node:perf_hooks';

export interface DiagnosticDistributionSnapshot {
	readonly count: number;
	readonly sum: number;
	readonly min: number;
	readonly max: number;
	readonly average: number;
	readonly p50: number;
	readonly p95: number;
	readonly p99: number;
}

export interface RuntimeTrace {
	readonly at: string;
	readonly category: string;
	readonly durationMs: number;
	readonly detail?: Readonly<Record<string, string | number | boolean | null>>;
}

type Distribution = {
	count: number;
	sum: number;
	min: number;
	max: number;
	samples: number[];
};

const MAX_METRICS = 256;
const MAX_TRACES = 128;
const MAX_DISTRIBUTION_SAMPLES = 128;
const NS_PER_MS = 1_000_000;

let eventLoopDelayHistogram: IntervalHistogram | undefined;

function eventLoopDelaySnapshot() {
	if (!eventLoopDelayHistogram) {
		eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
		eventLoopDelayHistogram.enable();
	}
	const histogram = eventLoopDelayHistogram;
	const ms = (value: number): number => Number.isFinite(value) ? value / NS_PER_MS : 0;
	return {
		p50Ms: ms(histogram.percentile(50)),
		p95Ms: ms(histogram.percentile(95)),
		p99Ms: ms(histogram.percentile(99)),
		maxMs: ms(histogram.max),
	};
}

function percentile(sorted: readonly number[], quantile: number): number {
	if (sorted.length === 0) return 0;
	const position = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1));
	return sorted[position];
}

class RuntimeDiagnostics {
	private readonly startedAt = Date.now();
	private readonly counters = new Map<string, number>();
	private readonly distributions = new Map<string, Distribution>();
	private readonly traces: RuntimeTrace[] = [];

	public increment(name: string, amount = 1): void {
		if (!Number.isFinite(amount) || amount === 0) return;
		if (!this.counters.has(name) && this.counters.size >= MAX_METRICS) return;
		this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
	}

	public observe(name: string, value: number): void {
		if (!Number.isFinite(value)) return;
		let metric = this.distributions.get(name);
		if (!metric) {
			if (this.distributions.size >= MAX_METRICS) return;
			metric = { count: 0, sum: 0, min: value, max: value, samples: [] };
			this.distributions.set(name, metric);
		}
		metric.count += 1;
		metric.sum += value;
		metric.min = Math.min(metric.min, value);
		metric.max = Math.max(metric.max, value);
		metric.samples.push(value);
		if (metric.samples.length > MAX_DISTRIBUTION_SAMPLES) metric.samples.splice(0, metric.samples.length - MAX_DISTRIBUTION_SAMPLES);
	}

	public trace(
		category: string,
		durationMs: number,
		detail?: Readonly<Record<string, string | number | boolean | null>>,
	): void {
		if (!Number.isFinite(durationMs)) return;
		this.traces.push({
			at: new Date().toISOString(),
			category,
			durationMs,
			...(detail ? { detail } : {}),
		});
		if (this.traces.length > MAX_TRACES) this.traces.splice(0, this.traces.length - MAX_TRACES);
	}

	public snapshot() {
		const distributions: Record<string, DiagnosticDistributionSnapshot> = {};
		for (const [name, metric] of this.distributions) {
			const sorted = [...metric.samples].sort((a, b) => a - b);
			distributions[name] = {
				count: metric.count,
				sum: metric.sum,
				min: metric.min,
				max: metric.max,
				average: metric.count === 0 ? 0 : metric.sum / metric.count,
				p50: percentile(sorted, 0.50),
				p95: percentile(sorted, 0.95),
				p99: percentile(sorted, 0.99),
			};
		}
		const memory = process.memoryUsage();
		const eventLoop = performance.eventLoopUtilization();
		return {
			startedAt: new Date(this.startedAt).toISOString(),
			uptimeMs: Date.now() - this.startedAt,
			process: {
				rssBytes: memory.rss,
				heapUsedBytes: memory.heapUsed,
				heapTotalBytes: memory.heapTotal,
				externalBytes: memory.external,
				eventLoopUtilization: eventLoop.utilization,
				eventLoopDelay: eventLoopDelaySnapshot(),
			},
			counters: Object.fromEntries(this.counters),
			distributions,
			recentTraces: [...this.traces],
		};
	}

	public reset(): void {
		this.counters.clear();
		this.distributions.clear();
		this.traces.length = 0;
		eventLoopDelayHistogram?.reset();
	}
}

export const runtimeDiagnostics = new RuntimeDiagnostics();

export async function measuredDiagnostic<T>(
	metric: string,
	operation: () => Promise<T>,
	traceThresholdMs = Infinity,
	detail?: Readonly<Record<string, string | number | boolean | null>>,
): Promise<T> {
	const startedAt = performance.now();
	try {
		return await operation();
	} finally {
		const durationMs = performance.now() - startedAt;
		runtimeDiagnostics.observe(metric, durationMs);
		if (durationMs >= traceThresholdMs) runtimeDiagnostics.trace(metric, durationMs, detail);
	}
}
