/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed } from 'vue';
import type { Ref, ShallowRef } from 'vue';

const DATE_CACHE_LIMIT = 4096;
const dateCache = new Map<string, {
	date: Date;
	dayKey: string;
	text: string;
}>();

export function getDateText(dateInstance: Date) {
	const date = dateInstance.getDate();
	const month = dateInstance.getMonth() + 1;
	return `${month.toString()}/${date.toString()}`;
}

function getCachedDateInfo(value: string) {
	const cached = dateCache.get(value);
	if (cached) return cached;

	const date = new Date(value);
	const info = {
		date,
		dayKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
		text: getDateText(date),
	};

	dateCache.set(value, info);
	if (dateCache.size > DATE_CACHE_LIMIT) {
		const oldestKey = dateCache.keys().next().value;
		if (oldestKey !== undefined) dateCache.delete(oldestKey);
	}

	return info;
}

export function isSeparatorNeeded(
	prev: string | null,
	next: string | null,
) {
	if (prev == null || next == null) return false;
	return getCachedDateInfo(prev).dayKey !== getCachedDateInfo(next).dayKey;
}

export function getSeparatorInfo(
	prev: string | null,
	next: string | null,
) {
	if (prev == null || next == null) return null;
	const prevInfo = getCachedDateInfo(prev);
	const nextInfo = getCachedDateInfo(next);
	return {
		prevDate: prevInfo.date,
		prevText: prevInfo.text,
		nextDate: nextInfo.date,
		nextText: nextInfo.text,
	};
}

export type DateSeparetedTimelineItem<T> = {
	id: string;
	type: 'item';
	data: T;
} | {
	id: string;
	type: 'date';
	prev: Date;
	prevText: string;
	next: Date;
	nextText: string;
};

export function makeDateSeparatedTimelineComputedRef<T extends { id: string; createdAt: string; }>(items: Ref<T[]> | ShallowRef<T[]>) {
	return computed<DateSeparetedTimelineItem<T>[]>(() => {
		const tl: DateSeparetedTimelineItem<T>[] = [];
		for (let i = 0; i < items.value.length; i++) {
			const item = items.value[i];

			const dateInfo = getCachedDateInfo(item.createdAt);
			const nextDateInfo = items.value[i + 1] ? getCachedDateInfo(items.value[i + 1].createdAt) : null;

			tl.push({
				id: item.id,
				type: 'item',
				data: item,
			});

			if (
				i !== items.value.length - 1 &&
					nextDateInfo != null &&
					dateInfo.dayKey !== nextDateInfo.dayKey
			) {
				tl.push({
					id: `date-${item.id}`,
					type: 'date',
					prev: dateInfo.date,
					prevText: dateInfo.text,
					next: nextDateInfo.date,
					nextText: nextDateInfo.text,
				});
			}
		}
		return tl;
	});
}

export type DateGroupedTimelineItem<T> = {
	date: Date;
	items: T[];
};

export function makeDateGroupedTimelineComputedRef<T extends { id: string; createdAt: string; }>(items: Ref<T[]> | ShallowRef<T[]>, span: 'day' | 'month' = 'day') {
	return computed<DateGroupedTimelineItem<T>[]>(() => {
		const tl: DateGroupedTimelineItem<T>[] = [];
		let lastGroupKey: string | null = null;
		for (let i = 0; i < items.value.length; i++) {
			const item = items.value[i];
			const dateInfo = getCachedDateInfo(item.createdAt);
			const date = dateInfo.date;
			const groupKey = span === 'day'
				? dateInfo.dayKey
				: `${date.getFullYear()}-${date.getMonth()}`;

			if (groupKey !== lastGroupKey) {
				tl.push({
					date,
					items: [],
				});
				lastGroupKey = groupKey;
			}
			tl[tl.length - 1].items.push(item);
		}
		return tl;
	});
}
