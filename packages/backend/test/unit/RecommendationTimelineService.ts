/*
 * SPDX-FileCopyrightText: 2026 Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Config } from '@/config.js';
import type { HttpRequestService } from '@/core/HttpRequestService.js';
import type { LoggerService } from '@/core/LoggerService.js';
import type { Packed } from '@/misc/json-schema.js';
import { RecommendationTimelineService } from '@/core/RecommendationTimelineService.js';

const sendMock = vi.fn();

function note(id: string, authorId: string): Packed<'Note'> {
	return {
		id,
		createdAt: new Date('2026-09-02T12:00:00Z').toISOString(),
		user: { id: authorId },
		reactions: {},
		repliesCount: 0,
		renoteCount: 0,
		renoteId: null,
	} as unknown as Packed<'Note'>;
}

function makeService(overrides: Partial<Config['recommendation']> = {}): RecommendationTimelineService {
	const config = {
		recommendation: {
			enabled: true,
			url: 'http://recommendation:3080',
			timeoutMs: 250,
			preservePageBoundaries: true,
			...overrides,
		},
	} as Config;
	const httpRequestService = { send: sendMock } as unknown as HttpRequestService;
	const loggerService = {
		getLogger: () => ({ warn: vi.fn() }),
	} as unknown as LoggerService;
	return new RecommendationTimelineService(config, httpRequestService, loggerService);
}

describe('RecommendationTimelineService', () => {
	beforeEach(() => {
		sendMock.mockReset();
	});

	test('reorders only IDs already present in the authorized timeline', async () => {
		const service = makeService({ preservePageBoundaries: false });
		const notes = [note('a', 'u1'), note('b', 'u2'), note('c', 'u3')];
		sendMock.mockResolvedValue({
			ok: true,
			json: async () => ({ orderedIds: ['c', 'foreign', 'c', 'a'] }),
		});

		const result = await service.rerank(notes, 'viewer');
		expect(result.map(item => item.id)).toEqual(['c', 'a', 'b']);
	});

	test('keeps chronological page boundaries while reranking the interior', async () => {
		const service = makeService();
		const notes = [note('newest', 'u1'), note('a', 'u1'), note('b', 'u2'), note('oldest', 'u3')];
		sendMock.mockResolvedValue({
			ok: true,
			json: async () => ({ orderedIds: ['oldest', 'b', 'a', 'newest'] }),
		});

		const result = await service.rerank(notes, 'viewer');
		expect(result.map(item => item.id)).toEqual(['newest', 'b', 'a', 'oldest']);
	});

	test('fails open when the recommendation service is unavailable', async () => {
		const service = makeService();
		const notes = [note('a', 'u1'), note('b', 'u2'), note('c', 'u3')];
		sendMock.mockRejectedValue(new Error('down'));

		const result = await service.rerank(notes, 'viewer');
		expect(result).toEqual(notes);
	});

	test('does not call the service when disabled', async () => {
		const service = makeService({ enabled: false });
		const notes = [note('a', 'u1'), note('b', 'u2')];

		await expect(service.rerank(notes, 'viewer')).resolves.toEqual(notes);
		expect(sendMock).not.toHaveBeenCalled();
	});

	test('uses the internal-address HTTP path with a tight timeout', async () => {
		const service = makeService({ preservePageBoundaries: false, timeoutMs: 123 });
		const notes = [note('a', 'u1'), note('b', 'u2')];
		sendMock.mockResolvedValue({
			ok: true,
			json: async () => ({ orderedIds: ['b', 'a'] }),
		});

		await service.rerank(notes, 'viewer');
		expect(sendMock).toHaveBeenCalledWith('http://recommendation:3080/v1/rerank', expect.objectContaining({
			method: 'POST',
			timeout: 123,
			isLocalAddressAllowed: true,
		}), {
			throwErrorWhenResponseNotOk: false,
			validators: [],
		});
	});

	test('forwards structural context metadata to the reranker', async () => {
		const service = makeService({ preservePageBoundaries: false });
		const contextual = {
			...note('reply', 'u1'),
			replyId: 'parent',
			renoteId: null,
			tags: ['outage'],
			mentions: ['u2'],
			channelId: 'channel',
			fileIds: ['file'],
		} as Packed<'Note'>;
		const other = note('other', 'u2');
		sendMock.mockResolvedValue({
			ok: true,
			json: async () => ({ orderedIds: ['reply', 'other'] }),
		});

		await service.rerank([contextual, other], 'viewer');

		const body = JSON.parse(sendMock.mock.calls[0][1].body as string);
		expect(body.candidates[0]).toMatchObject({
			id: 'reply',
			authorId: 'u1',
			authorHost: null,
			hasMedia: true,
			isReply: true,
			isRenote: false,
			replyToId: 'parent',
			renoteOfId: null,
			tags: ['outage'],
			mentions: ['u2'],
			channelId: 'channel',
		});
	});

	test('discovers extra candidates, lets Misskey hydrate/filter them, then keeps page boundaries', async () => {
		const service = makeService();
		const notes = [note('newest', 'u1'), note('middle-a', 'u2'), note('middle-b', 'u3'), note('oldest', 'u4')];
		const rediscovered = note('rediscovered', 'u5');
		const loadCandidates = vi.fn(async (ids: string[]) => {
			expect(ids).toEqual(['rediscovered', 'unauthorized']);
			return [rediscovered];
		});
		sendMock.mockImplementation(async (url: string) => {
			if (url.endsWith('/v1/candidates')) {
				return {
					ok: true,
					json: async () => ({ candidateIds: ['rediscovered', 'unauthorized'] }),
				};
			}
			return {
				ok: true,
				json: async () => ({ orderedIds: ['newest', 'rediscovered', 'middle-b', 'oldest'] }),
			};
		});

		const result = await service.mix(notes, 'viewer', {
			limit: 3,
			enableDiscovery: true,
			loadCandidates,
		});

		expect(result.map(item => item.id)).toEqual(['newest', 'rediscovered', 'oldest']);
		expect(loadCandidates).toHaveBeenCalledTimes(1);
		expect(sendMock).toHaveBeenCalledTimes(2);
		const discoveryBody = JSON.parse(sendMock.mock.calls[0][1].body as string);
		expect(discoveryBody.excludeIds).toEqual(notes.map(item => item.id));
		expect(discoveryBody.limit).toBe(24);
	});

	test('does not pull rediscovery candidates on paginated requests', async () => {
		const service = makeService({ preservePageBoundaries: false });
		const notes = [note('a', 'u1'), note('b', 'u2'), note('c', 'u3')];
		const loadCandidates = vi.fn(async () => [note('rediscovered', 'u4')]);
		sendMock.mockResolvedValue({
			ok: true,
			json: async () => ({ orderedIds: ['b', 'a', 'c'] }),
		});

		const result = await service.mix(notes, 'viewer', {
			limit: 3,
			enableDiscovery: false,
			loadCandidates,
		});

		expect(result.map(item => item.id)).toEqual(['b', 'a', 'c']);
		expect(loadCandidates).not.toHaveBeenCalled();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});
});

