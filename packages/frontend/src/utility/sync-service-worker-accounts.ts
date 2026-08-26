/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { host } from '@@/js/config.js';
import { store } from '@/store.js';
import { set } from '@/utility/idb-proxy.js';

/**
 * Keep the account tokens used by service-worker notification actions in sync
 * with the frontend's device account store. Only accounts for this origin are
 * copied because a service worker cannot authenticate against another host.
 */
export async function syncServiceWorkerAccounts(): Promise<void> {
	const prefix = `${host}/`;
	const accounts = Object.entries(store.s.accountTokens)
		.filter(([accountKey]) => accountKey.startsWith(prefix))
		.map(([accountKey, token]) => ({
			id: accountKey.slice(prefix.length),
			token,
		}));

	await set('accounts', accounts);
}
