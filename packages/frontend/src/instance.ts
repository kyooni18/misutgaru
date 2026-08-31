/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, reactive } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { miLocalStorage } from '@/local-storage.js';

// TODO: 他のタブと永続化されたstateを同期

//#region loader
const providedMetaEl = window.document.getElementById('misskey_meta');

function parseMeta(raw: string | null, source: string): Misskey.entities.MetaDetailed | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
			? parsed as Misskey.entities.MetaDetailed
			: null;
	} catch (error) {
		console.warn(`[instance] Ignoring invalid ${source} metadata`, error);
		return null;
	}
}

function parseTimestamp(raw: string | undefined | null): number {
	if (!raw) return 0;
	const value = Number.parseInt(raw, 10);
	return Number.isFinite(value) ? value : 0;
}

function cacheMeta(meta: Misskey.entities.MetaDetailed, at: number) {
	try {
		miLocalStorage.setItem('instance', JSON.stringify(meta));
		miLocalStorage.setItem('instanceCachedAt', at.toString());
	} catch (error) {
		console.warn('[instance] Failed to persist instance metadata', error);
	}
}

let cachedMeta = parseMeta(miLocalStorage.getItem('instance'), 'cached');
let cachedAt = parseTimestamp(miLocalStorage.getItem('instanceCachedAt'));
const providedMeta = parseMeta(providedMetaEl?.textContent ?? null, 'provided');
const providedAt = parseTimestamp(providedMetaEl?.dataset.generatedAt);
if (providedMeta != null && providedAt > cachedAt) {
	cacheMeta(providedMeta, providedAt);
	cachedMeta = providedMeta;
	cachedAt = providedAt;
}
//#endregion

// TODO: instanceをリアクティブにするかは再考の余地あり

// The shell intentionally starts before metadata is guaranteed to be present;
// fetchInstance() hydrates this stable reactive object in place. Keep that
// runtime behavior while making the temporary empty state explicit to TS.
export const instance = reactive(cachedMeta ?? {} as Misskey.entities.MetaDetailed) as Misskey.entities.MetaDetailed;

export async function fetchInstance(force = false): Promise<Misskey.entities.MetaDetailed> {
	if (!force) {
		const cachedAt = parseTimestamp(miLocalStorage.getItem('instanceCachedAt'));

		if (Date.now() - cachedAt < 1000 * 60 * 60) {
			return instance;
		}
	}

	const meta = await misskeyApi('meta', {
		detail: true,
	});

	for (const [k, v] of Object.entries(meta)) {
		(instance[k as keyof typeof meta] as any) = v;
	}

	cacheMeta(instance, Date.now());

	return instance;
}
