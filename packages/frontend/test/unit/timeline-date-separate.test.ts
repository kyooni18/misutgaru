/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { ref } from 'vue';
import {
	getSeparatorInfo,
	isSeparatorNeeded,
	makeDateGroupedTimelineComputedRef,
} from '@/utility/timeline-date-separate.js';

describe('timeline date separation', () => {
	test('groups different times on the same local day together', () => {
		const morning = new Date(2026, 7, 27, 8, 0, 0).toISOString();
		const evening = new Date(2026, 7, 27, 22, 30, 0).toISOString();
		const items = ref([
			{ id: 'morning', createdAt: morning },
			{ id: 'evening', createdAt: evening },
		]);

		const grouped = makeDateGroupedTimelineComputedRef(items, 'day');

		assert.strictEqual(grouped.value.length, 1);
		assert.deepStrictEqual(grouped.value[0].items.map(item => item.id), ['morning', 'evening']);
		assert.strictEqual(isSeparatorNeeded(morning, evening), false);
	});

	test('separates adjacent local days and exposes their labels', () => {
		const first = new Date(2026, 7, 27, 23, 59, 0).toISOString();
		const second = new Date(2026, 7, 28, 0, 1, 0).toISOString();

		assert.strictEqual(isSeparatorNeeded(first, second), true);
		const info = getSeparatorInfo(first, second);
		assert.ok(info);
		assert.strictEqual(info.prevText, '8/27');
		assert.strictEqual(info.nextText, '8/28');
	});
});
