/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, readonly, computed } from 'vue';
import { createVisibilityAwareInterval } from '@@/js/interval.js';

const time = ref(Date.now());
const minuteTime = ref(time.value);
const tenMinuteTime = ref(time.value);
const hourTime = ref(time.value);
const dayTime = ref(time.value);

let minuteBucket = Math.floor(time.value / 60000);
let tenMinuteBucket = Math.floor(time.value / 600000);
let hourBucket = Math.floor(time.value / 3600000);
let dayBucket = Math.floor(time.value / 86400000);

export const TIME_UPDATE_INTERVAL = 10000; // 10秒

/**
 * 精度が求められないが定期的に更新しないといけない時計で使用（10秒に一度更新）。
 * tickを各コンポーネントで行うのではなく、ここで一括して行うことでパフォーマンスを改善する。
 *
 * ※ マウント前の時刻を返す可能性があるため、通常は`useLowresTime`を使用する
*/
export const lowresTime = readonly(time);

/**
 * 精度が求められないが定期的に更新しないといけない時計で使用（10秒に一度更新）。
 * tickを各コンポーネントで行うのではなく、ここで一括して行うことでパフォーマンスを改善する。
 *
 * 必ず現在時刻以降を返すことを保証するコンポーサブル
 */
export function useLowresTime() {
	// lowresTime自体はマウント前の時刻を返す可能性があるため、必ず現在時刻以降を返すことを保証する
	const now = Date.now();
	return computed(() => Math.max(time.value, now));
}

export type AdaptiveTimeResolution = 'tenSeconds' | 'minute' | 'tenMinutes' | 'hour' | 'day';

export function adaptiveTimeResolution(referenceTime: number, now = Date.now()): AdaptiveTimeResolution {
	const distance = Math.abs(now - referenceTime);
	if (distance < 60_000) return 'tenSeconds';
	if (distance < 3_600_000) return 'minute';
	if (distance < 86_400_000) return 'tenMinutes';
	if (distance < 604_800_000) return 'hour';
	return 'day';
}

/**
 * Relative timestamps do not all need to wake every ten seconds. Older values
 * subscribe to progressively slower shared clocks, while fresh/future-near
 * values automatically move between tiers as their current tier advances.
 */
export function useAdaptiveLowresTime(referenceTime: number) {
	const mountedAt = Date.now();
	return computed(() => {
		const resolution = adaptiveTimeResolution(referenceTime);
		const source = resolution === 'tenSeconds' ? time
			: resolution === 'minute' ? minuteTime
				: resolution === 'tenMinutes' ? tenMinuteTime
					: resolution === 'hour' ? hourTime
						: dayTime;
		return Math.max(source.value, mountedAt);
	});
}

createVisibilityAwareInterval(() => {
	const now = Date.now();
	time.value = now;

	const nextMinuteBucket = Math.floor(now / 60000);
	if (nextMinuteBucket !== minuteBucket) {
		minuteBucket = nextMinuteBucket;
		minuteTime.value = now;
	}

	const nextTenMinuteBucket = Math.floor(now / 600000);
	if (nextTenMinuteBucket !== tenMinuteBucket) {
		tenMinuteBucket = nextTenMinuteBucket;
		tenMinuteTime.value = now;
	}

	const nextHourBucket = Math.floor(now / 3600000);
	if (nextHourBucket !== hourBucket) {
		hourBucket = nextHourBucket;
		hourTime.value = now;
	}

	const nextDayBucket = Math.floor(now / 86400000);
	if (nextDayBucket !== dayBucket) {
		dayBucket = nextDayBucket;
		dayTime.value = now;
	}
}, TIME_UPDATE_INTERVAL);
