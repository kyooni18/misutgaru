/*
 * SPDX-FileCopyrightText: 2026 Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { Packed } from '@/misc/json-schema.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { LoggerService } from '@/core/LoggerService.js';

type RerankResponse = {
	orderedIds?: unknown;
};

type DiscoverResponse = {
	candidateIds?: unknown;
};

type MixOptions = {
	limit: number;
	enableDiscovery: boolean;
	loadCandidates?: (ids: string[]) => Promise<Packed<'Note'>[]>;
};

@Injectable()
export class RecommendationTimelineService {
	private readonly logger;
	private lastWarningAt = 0;

	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		private readonly httpRequestService: HttpRequestService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService.getLogger('recommendation');
	}

	public isAvailable(): boolean {
		return this.config.recommendation.enabled && this.config.recommendation.url !== '';
	}

	public async rerank(
		notes: Packed<'Note'>[],
		viewerId: string | null,
		resultLimit = notes.length,
	): Promise<Packed<'Note'>[]> {
		const targetLimit = Math.max(0, Math.min(resultLimit, notes.length));
		if (targetLimit === 0) return [];
		if (!this.isAvailable() || notes.length < 2) return notes.slice(0, targetLimit);

		const original = [...notes];
		try {
			const response = await this.httpRequestService.send(`${this.config.recommendation.url}/v1/rerank`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({
					viewerId,
					preserveBoundaries: this.config.recommendation.preservePageBoundaries,
					resultLimit: targetLimit,
					candidates: original.map((note, sourceRank) => ({
						id: note.id,
						authorId: note.user.id,
						authorHost: note.user.host ?? null,
						createdAtMs: Number.isFinite(Date.parse(note.createdAt)) ? Date.parse(note.createdAt) : Date.now(),
						sourceRank,
						reactionCount: Object.values(note.reactions).reduce((sum, count) => sum + count, 0),
						replyCount: note.repliesCount,
						renoteCount: note.renoteCount,
						hasMedia: (note.fileIds?.length ?? 0) > 0,
						isReply: note.replyId != null,
						isRenote: note.renoteId != null,
						replyToId: note.replyId ?? null,
						renoteOfId: note.renoteId ?? null,
						tags: note.tags ?? [],
						mentions: note.mentions ?? [],
						channelId: note.channelId ?? null,
					}))
				}),
				timeout: this.config.recommendation.timeoutMs,
				size: 1024 * 256,
				isLocalAddressAllowed: true,
			}, {
				throwErrorWhenResponseNotOk: false,
				validators: [],
			});

			if (!response.ok) {
				this.warnThrottled(`Recommendation service returned HTTP ${response.status}; using chronological order.`);
				return original;
			}

			const json = await response.json() as RerankResponse;
			if (!Array.isArray(json.orderedIds)) {
				this.warnThrottled('Recommendation service returned an invalid order; using chronological order.');
				return original;
			}

			const byId = new Map(original.map(note => [note.id, note]));
			const used = new Set<string>();
			const reranked: Packed<'Note'>[] = [];
			for (const id of json.orderedIds) {
				if (reranked.length >= targetLimit) break;
				if (typeof id !== 'string' || used.has(id)) continue;
				const note = byId.get(id);
				if (note == null) continue;
				used.add(id);
				reranked.push(note);
			}

			for (const note of original) {
				if (reranked.length >= targetLimit) break;
				if (!used.has(note.id)) {
					used.add(note.id);
					reranked.push(note);
				}
			}

			return this.config.recommendation.preservePageBoundaries
				? this.restorePageBoundaries(original, reranked, targetLimit)
				: reranked.slice(0, targetLimit);
		} catch {
			this.warnThrottled('Recommendation service request failed; using chronological order.');
			return original.slice(0, targetLimit);
		}
	}

	public async mix(
		notes: Packed<'Note'>[],
		viewerId: string | null,
		options: MixOptions,
	): Promise<Packed<'Note'>[]> {
		const limit = Math.max(0, Math.min(options.limit, notes.length === 0 ? options.limit : 100));
		if (limit === 0 || notes.length === 0) return [];

		if (!options.enableDiscovery || viewerId == null || options.loadCandidates == null || notes.length < 3 || !this.isAvailable()) {
			return await this.rerank(notes, viewerId, Math.min(limit, notes.length));
		}

		const candidateIds = await this.discoverCandidateIds(
			viewerId,
			notes.map(note => note.id),
			Math.min(200, Math.max(24, limit * 8)),
			this.noteCreatedAtMs(notes.at(-1)!),
		);
		if (candidateIds.length === 0) {
			return await this.rerank(notes, viewerId, Math.min(limit, notes.length));
		}

		let discovered: Packed<'Note'>[];
		try {
			discovered = await options.loadCandidates(candidateIds);
		} catch {
			this.warnThrottled('Recommendation candidate hydration failed; using the normal timeline page.');
			return await this.rerank(notes, viewerId, Math.min(limit, notes.length));
		}

		const merged = this.mergeCandidates(notes, discovered);
		return await this.rerank(merged, viewerId, Math.min(limit, merged.length));
	}

	private async discoverCandidateIds(
		viewerId: string,
		excludeIds: string[],
		limit: number,
		olderThanMs: number,
	): Promise<string[]> {
		try {
			const response = await this.httpRequestService.send(`${this.config.recommendation.url}/v1/candidates`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({
					viewerId,
					excludeIds,
					limit,
					olderThanMs,
				}),
				timeout: this.config.recommendation.timeoutMs,
				size: 1024 * 256,
				isLocalAddressAllowed: true,
			}, {
				throwErrorWhenResponseNotOk: false,
				validators: [],
			});

			if (!response.ok) {
				this.warnThrottled(`Recommendation candidate service returned HTTP ${response.status}; skipping rediscovery.`);
				return [];
			}

			const json = await response.json() as DiscoverResponse;
			if (!Array.isArray(json.candidateIds)) return [];
			const result: string[] = [];
			const seen = new Set(excludeIds);
			for (const id of json.candidateIds) {
				if (typeof id !== 'string' || seen.has(id)) continue;
				seen.add(id);
				result.push(id);
				if (result.length >= limit) break;
			}
			return result;
		} catch {
			this.warnThrottled('Recommendation candidate request failed; skipping rediscovery.');
			return [];
		}
	}

	private mergeCandidates(original: Packed<'Note'>[], discovered: Packed<'Note'>[]): Packed<'Note'>[] {
		if (original.length <= 2 || discovered.length === 0) return original;
		const originalIds = new Set(original.map(note => note.id));
		const extras: Packed<'Note'>[] = [];
		for (const note of discovered) {
			if (originalIds.has(note.id)) continue;
			originalIds.add(note.id);
			extras.push(note);
		}
		if (extras.length === 0) return original;

		const merged: Packed<'Note'>[] = [original[0]];
		const interior = original.slice(1, -1);
		let extraIndex = 0;
		for (let i = 0; i < interior.length; i++) {
			merged.push(interior[i]);
			if ((i + 1) % 2 === 0 && extraIndex < extras.length) {
				merged.push(extras[extraIndex++]);
			}
		}
		while (extraIndex < extras.length) merged.push(extras[extraIndex++]);
		merged.push(original.at(-1)!);
		return merged;
	}

	private restorePageBoundaries(original: Packed<'Note'>[], reranked: Packed<'Note'>[], limit: number): Packed<'Note'>[] {
		if (limit <= 0) return [];
		if (limit === 1 || original.length === 1) return [original[0]];
		const newest = original[0];
		const oldest = original[original.length - 1];
		const interior = reranked
			.filter(note => note.id !== newest.id && note.id !== oldest.id)
			.slice(0, Math.max(0, limit - 2));
		return [newest, ...interior, oldest];
	}

	private noteCreatedAtMs(note: Packed<'Note'>): number {
		const parsed = Date.parse(note.createdAt);
		return Number.isFinite(parsed) ? parsed : Date.now();
	}

	private warnThrottled(message: string): void {
		const now = Date.now();
		if (now - this.lastWarningAt < 60_000) return;
		this.lastWarningAt = now;
		this.logger.warn(message);
	}
}

