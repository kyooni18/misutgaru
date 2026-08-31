/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import type * as Misskey from 'misskey-js';
import { Paginator } from '@/utility/paginator.js';

function note(id: string): Misskey.entities.Note {
	return {
		id,
		createdAt: '2026-08-28T00:00:00.000Z',
	} as Misskey.entities.Note;
}

function paginator(maxItems = 8) {
	return new Paginator('notes/timeline', {
		useShallowRef: true,
		maxItems,
	});
}

describe('Paginator identity merging', () => {
	test('finds paging extrema without depending on retained item order', () => {
		const p = paginator();
		p.items.value = [note('2'), note('9'), note('1'), note('5')];
		expect((p as unknown as { getNewestId: () => string | undefined }).getNewestId()).toBe('9');
		expect((p as unknown as { getOldestId: () => string | undefined }).getOldestId()).toBe('1');
	});

	test('deduplicates both existing IDs and duplicates inside one prepended batch', () => {
		const p = paginator();
		p.items.value = [note('3'), note('2')];
		p.unshiftItems([note('4'), note('4'), note('3')]);
		expect(p.items.value.map(item => item.id)).toEqual(['4', '3', '2']);
	});

	test('deduplicates overlapping older pages', () => {
		const p = paginator();
		p.items.value = [note('5'), note('4'), note('3')];
		p.pushItems([note('3'), note('2'), note('2'), note('1')]);
		expect(p.items.value.map(item => item.id)).toEqual(['5', '4', '3', '2', '1']);
	});

	test('trims a realtime prepend to the configured identity window', () => {
		const p = paginator(3);
		p.items.value = [note('3'), note('2'), note('1')];
		p.unshiftItems([note('4')]);
		expect(p.items.value.map(item => item.id)).toEqual(['4', '3', '2']);
		expect(p.canFetchOlder.value).toBe(true);
	});
});
