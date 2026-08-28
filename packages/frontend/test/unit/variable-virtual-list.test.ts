/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import { shouldPreserveVirtualAnchor } from '@/composables/use-variable-virtual-list.js';

describe('variable virtual list anchoring', () => {
	test('shows newly prepended feed items while the viewport is at the list start', () => {
		expect(shouldPreserveVirtualAnchor(0)).toBe(false);
		expect(shouldPreserveVirtualAnchor(0.5)).toBe(false);
	});

	test('preserves the visible logical row after the user has scrolled into the list', () => {
		expect(shouldPreserveVirtualAnchor(2)).toBe(true);
		expect(shouldPreserveVirtualAnchor(800)).toBe(true);
	});
});
