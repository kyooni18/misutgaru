/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import { adaptiveTimeResolution } from '@/composables/use-lowres-time.js';

describe('adaptiveTimeResolution', () => {
	const now = Date.UTC(2026, 7, 30, 12, 0, 0);

	test.each([
		[30_000, 'tenSeconds'],
		[90_000, 'minute'],
		[2 * 60 * 60 * 1000, 'tenMinutes'],
		[2 * 24 * 60 * 60 * 1000, 'hour'],
		[30 * 24 * 60 * 60 * 1000, 'day'],
	] as const)('uses progressively slower clocks at distance %i', (distance, expected) => {
		expect(adaptiveTimeResolution(now - distance, now)).toBe(expected);
		expect(adaptiveTimeResolution(now + distance, now)).toBe(expected);
	});
});
