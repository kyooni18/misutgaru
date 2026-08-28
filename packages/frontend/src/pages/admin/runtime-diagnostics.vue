<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="[]">
	<div class="_spacer" style="--MI_SPACER-w: 900px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<div v-if="refreshError" class="_panel" :class="$style.errorPanel">
				<i class="ti ti-alert-triangle"></i>
				<span>{{ refreshError }}</span>
			</div>

			<div :class="$style.summary">
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Process uptime</div>
					<div :class="$style.value">{{ formatDuration(snapshot?.uptimeMs ?? 0) }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Heap used</div>
					<div :class="$style.value">{{ formatBytes(snapshot?.process.heapUsedBytes ?? 0) }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">RSS</div>
					<div :class="$style.value">{{ formatBytes(snapshot?.process.rssBytes ?? 0) }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Event loop utilization</div>
					<div :class="$style.value">{{ ((snapshot?.process.eventLoopUtilization ?? 0) * 100).toFixed(1) }}%</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Event loop delay P95</div>
					<div :class="$style.value">{{ (snapshot?.process.eventLoopDelay.p95Ms ?? 0).toFixed(1) }} ms</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Redis cache hit rate</div>
					<div :class="$style.value">{{ cacheHitRate }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Cache stale retries</div>
					<div :class="$style.value">{{ formatNumber(cacheStaleRetries) }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Counters</div>
					<div :class="$style.value">{{ counterRows.length }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Distributions</div>
					<div :class="$style.value">{{ distributionRows.length }}</div>
				</div>
				<div class="_panel" :class="$style.card">
					<div :class="$style.label">Recent traces</div>
					<div :class="$style.value">{{ snapshot?.recentTraces.length ?? 0 }}</div>
				</div>
			</div>

			<div class="_panel" :class="$style.panel">
				<div :class="$style.panelHeader">
					<div>
						<div :class="$style.heading">Counters</div>
						<div :class="$style.caption">Process-local totals since this backend process started</div>
					</div>
				</div>
				<div :class="$style.tableWrap">
					<table :class="$style.table">
						<thead><tr><th>Metric</th><th>Value</th></tr></thead>
						<tbody>
							<tr v-for="row in counterRows" :key="row.name"><td><code>{{ row.name }}</code></td><td>{{ formatNumber(row.value) }}</td></tr>
							<tr v-if="counterRows.length === 0"><td colspan="2" :class="$style.empty">No samples yet</td></tr>
						</tbody>
					</table>
				</div>
			</div>

			<div class="_panel" :class="$style.panel">
				<div :class="$style.panelHeader">
					<div>
						<div :class="$style.heading">Distributions</div>
						<div :class="$style.caption">Batch sizes and latency observations. No samples are persisted.</div>
					</div>
				</div>
				<div :class="$style.tableWrap">
					<table :class="$style.table">
						<thead><tr><th>Metric</th><th>Count</th><th>Average</th><th>P50</th><th>P95</th><th>P99</th><th>Min</th><th>Max</th></tr></thead>
						<tbody>
							<tr v-for="row in distributionRows" :key="row.name">
								<td><code>{{ row.name }}</code></td>
								<td>{{ formatNumber(row.count) }}</td>
								<td>{{ formatMetric(row.name, row.average) }}</td>
								<td>{{ formatMetric(row.name, row.p50) }}</td>
								<td>{{ formatMetric(row.name, row.p95) }}</td>
								<td>{{ formatMetric(row.name, row.p99) }}</td>
								<td>{{ formatMetric(row.name, row.min) }}</td>
								<td>{{ formatMetric(row.name, row.max) }}</td>
							</tr>
							<tr v-if="distributionRows.length === 0"><td colspan="8" :class="$style.empty">No samples yet</td></tr>
						</tbody>
					</table>
				</div>
			</div>

			<div class="_panel" :class="$style.panel">
				<div :class="$style.panelHeader">
					<div>
						<div :class="$style.heading">Slow traces</div>
						<div :class="$style.caption">Bounded in-memory ring buffer from the current process</div>
					</div>
				</div>
				<div :class="$style.traceList">
					<div v-for="trace in snapshot?.recentTraces ?? []" :key="`${trace.at}:${trace.category}:${trace.durationMs}`" :class="$style.trace">
						<div :class="$style.traceMain"><code>{{ trace.category }}</code><span>{{ trace.durationMs.toFixed(2) }} ms</span></div>
						<div :class="$style.traceMeta"><span>{{ new Date(trace.at).toLocaleString() }}</span><span v-if="trace.detail"><code>{{ formatDetail(trace.detail) }}</code></span></div>
					</div>
					<div v-if="(snapshot?.recentTraces.length ?? 0) === 0" :class="$style.empty">No slow traces yet</div>
				</div>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type Distribution = {
	count: number;
	sum: number;
	min: number;
	max: number;
	average: number;
	p50: number;
	p95: number;
	p99: number;
};

type RuntimeDiagnosticsSnapshot = {
	startedAt: string;
	uptimeMs: number;
	process: {
		rssBytes: number;
		heapUsedBytes: number;
		heapTotalBytes: number;
		externalBytes: number;
		eventLoopUtilization: number;
		eventLoopDelay: {
			p50Ms: number;
			p95Ms: number;
			p99Ms: number;
			maxMs: number;
		};
	};
	counters: Array<{ name: string; value: number }>;
	distributions: Array<{ name: string } & Distribution>;
	recentTraces: Array<{
		at: string;
		category: string;
		durationMs: number;
		detail?: Record<string, string | number | boolean | null>;
	}>;
};

const snapshot = ref<RuntimeDiagnosticsSnapshot | null>(null);
const refreshError = ref<string | null>(null);
let refreshTimer: number | null = null;
let requestInFlight = false;

const counterRows = computed(() => [...(snapshot.value?.counters ?? [])]
	.sort((a, b) => a.name.localeCompare(b.name)));
const distributionRows = computed(() => [...(snapshot.value?.distributions ?? [])]
	.sort((a, b) => a.name.localeCompare(b.name)));
const counterMap = computed(() => new Map((snapshot.value?.counters ?? []).map(row => [row.name, row.value] as const)));
const cacheHitRate = computed(() => {
	const memoryHits = (counterMap.value.get('cache.kv.memoryHit') ?? 0) + (counterMap.value.get('cache.single.memoryHit') ?? 0);
	const redisHits = (counterMap.value.get('cache.kv.redisHit') ?? 0) + (counterMap.value.get('cache.single.redisHit') ?? 0);
	const redisMisses = (counterMap.value.get('cache.kv.redisMiss') ?? 0) + (counterMap.value.get('cache.single.redisMiss') ?? 0);
	const total = memoryHits + redisHits + redisMisses;
	return total === 0 ? '—' : `${(((memoryHits + redisHits) / total) * 100).toFixed(1)}%`;
});
const cacheStaleRetries = computed(() => (counterMap.value.get('cache.kv.staleRetry') ?? 0) + (counterMap.value.get('cache.single.staleRetry') ?? 0));

async function refresh(): Promise<void> {
	if (requestInFlight || window.document.visibilityState === 'hidden') return;
	requestInFlight = true;
	try {
		snapshot.value = await misskeyApi<RuntimeDiagnosticsSnapshot>(
			'admin/runtime-diagnostics' as keyof Misskey.Endpoints,
			{} as never,
		);
		refreshError.value = null;
	} catch (error) {
		refreshError.value = error instanceof Error ? error.message : String(error);
	} finally {
		requestInFlight = false;
	}
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat().format(value);
}

function formatBytes(value: number): string {
	if (value < 1024) return `${value} B`;
	const units = ['KiB', 'MiB', 'GiB', 'TiB'];
	let scaled = value / 1024;
	let unit = 0;
	while (scaled >= 1024 && unit < units.length - 1) { scaled /= 1024; unit += 1; }
	return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatMetric(name: string, value: number): string {
	return name.toLowerCase().includes('duration') || name.toLowerCase().includes('latency')
		? `${value.toFixed(2)} ms`
		: value.toFixed(value >= 100 ? 0 : 2);
}

function formatDetail(detail: Record<string, string | number | boolean | null>): string {
	try {
		return JSON.stringify(detail);
	} catch {
		return String(detail);
	}
}

function formatDuration(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	return [days ? `${days}d` : '', hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', `${seconds}s`].filter(Boolean).join(' ');
}

const headerActions = computed(() => [{
	icon: 'ti ti-refresh',
	text: 'Refresh',
	handler: refresh,
}]);

onMounted(() => {
	void refresh();
	refreshTimer = window.setInterval(() => void refresh(), 2500);
});

onBeforeUnmount(() => {
	if (refreshTimer !== null) window.clearInterval(refreshTimer);
});

definePage(() => ({
	title: 'Runtime diagnostics',
	icon: 'ti ti-activity-heartbeat',
}));
</script>

<style lang="scss" module>
.summary {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 12px;
}
.errorPanel {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 16px;
	color: var(--MI_THEME-error);
}
.card { padding: 16px; }
.label { opacity: 0.7; font-size: 0.85em; }
.value { margin-top: 6px; font-size: 1.4em; font-weight: 700; }
.panel { overflow: clip; }
.panelHeader { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: solid 1px var(--MI_THEME-divider); }
.heading { font-weight: 700; }
.caption { margin-top: 4px; opacity: 0.65; font-size: 0.85em; }
.tableWrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 14px; text-align: right; border-bottom: solid 1px var(--MI_THEME-divider); white-space: nowrap; }
.table th:first-child, .table td:first-child { text-align: left; }
.table tbody tr:last-child td { border-bottom: 0; }
.traceList { display: grid; }
.trace { padding: 12px 16px; border-bottom: solid 1px var(--MI_THEME-divider); }
.trace:last-child { border-bottom: 0; }
.traceMain { display: flex; justify-content: space-between; gap: 16px; }
.traceMeta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 5px; opacity: 0.65; font-size: 0.82em; }
.empty { padding: 18px !important; text-align: center !important; opacity: 0.6; }
</style>
