/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, ref } from 'vue';
import { store } from '@/store.js';

// Bundled multi-language unicode emoji keyword indexes. They are lazily loaded so that
// emoji search works in every bundled language without manual download in settings.
const loaders: Record<string, () => Promise<Record<string, string[]>>> = {
	'en-US': () => import('@misskey-dev/emoji-data/indexes/en-US.json').then(x => x.default),
	'ja-JP': () => import('@misskey-dev/emoji-data/indexes/ja-JP.json').then(x => x.default),
	'ja-JP_hira': () => import('@misskey-dev/emoji-data/indexes/ja-JP_hira.json').then(x => x.default),
};

const bundled = ref<Record<string, Record<string, string[]>>>({});
let loading: Promise<void> | null = null;

export function loadBundledEmojiIndexes(): Promise<void> {
	loading ??= Promise.all(Object.entries(loaders).map(async ([lang, load]) => {
		try {
			const index = await load();
			bundled.value = { ...bundled.value, [lang]: index };
		} catch (err) {
			console.error('failed to load emoji index', lang, err);
		}
	})).then(() => undefined);
	return loading;
}

/** Installed (settings) indexes take priority over bundled ones with the same language key. */
export const unicodeEmojiSearchIndexes = computed(() => ({
	...bundled.value,
	...store.r.additionalUnicodeEmojiIndexes.value,
}));

/** NFKC + lowercase + katakana -> hiragana so that queries match across scripts/width. */
export function normalizeEmojiQuery(s: string): string {
	return s.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
