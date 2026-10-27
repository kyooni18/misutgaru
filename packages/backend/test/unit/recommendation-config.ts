/*
 * SPDX-FileCopyrightText: 2026 Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadConfig } from '@/config.js';

const fixture = vi.hoisted(() => ({ recommendation: {} as Record<string, unknown> }));

vi.mock('node:fs', () => ({
	existsSync: () => true,
	readFileSync: (path: string) => JSON.stringify(path.endsWith('meta.json') ? { version: 'test' } : {
		url: 'https://example.test',
		db: {},
		redis: {},
		recommendation: fixture.recommendation,
	}),
}));

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('experimental recommendation opt-in', () => {
	test.each([
		[{}, undefined, undefined, false],
		[{}, undefined, 'http://recommendation:3080', false],
		[{ url: 'http://recommendation:3080' }, undefined, undefined, false],
		[{}, 'false', 'http://recommendation:3080', false],
		[{}, '1', 'http://recommendation:3080', false],
		[{}, 'true', 'http://recommendation:3080', true],
		[{}, 'true', undefined, false],
		[{ enabled: true, url: 'http://recommendation:3080' }, undefined, undefined, true],
		[{ enabled: false }, 'true', 'http://recommendation:3080', false],
		[{ enabled: 'false' }, 'true', 'http://recommendation:3080', false],
	])('requires explicit enablement and a URL: %j, %s, %s', (config, enabled, url, expected) => {
		fixture.recommendation = config;
		vi.stubEnv('MISUTGARU_RECOMMENDATION_ENABLED', enabled);
		vi.stubEnv('MISUTGARU_RECOMMENDATION_URL', url);
		expect(loadConfig().recommendation.enabled).toBe(expected);
	});
});
