/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive } from 'vue';
import * as Misskey from 'misskey-js';
import { miLocalStorage } from '@/local-storage.js';

// TODO: 他のタブと永続化されたstateを同期

type AccountWithToken = Misskey.entities.MeDetailed & { token: string };

const accountData = miLocalStorage.getItem('account');
let parsedAccount: AccountWithToken | null = null;
if (accountData) {
	try {
		const parsed = JSON.parse(accountData) as unknown;
		if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
			parsedAccount = parsed as AccountWithToken;
		}
	} catch (error) {
		console.warn('[account] Ignoring invalid cached account data', error);
	}
}

// TODO: 外部からはreadonlyに
export const $i = parsedAccount ? reactive(parsedAccount) : null;

export const iAmModerator = $i != null && ($i.isAdmin === true || $i.isModerator === true);
export const iAmAdmin = $i != null && $i.isAdmin;

export function ensureSignin() {
	if ($i == null) throw new Error('signin required');
	return $i;
}

export let notesCount = $i == null ? 0 : $i.notesCount;
export function incNotesCount() {
	notesCount++;
}

if (_DEV_) {
	(window as any).$i = $i;
}
