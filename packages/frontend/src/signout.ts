/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { apiUrl } from '@@/js/config.js';
import { cloudBackup } from '@/preferences/utility.js';
import { store } from '@/store.js';
import { waiting } from '@/os.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { clear } from '@/utility/idb-proxy.js';
import { $i } from '@/i.js';

export async function signout() {
	if (!$i) return;

	waiting();

	if (store.s.enablePreferencesAutoCloudBackup) {
		await cloudBackup();
	}

	localStorage.clear();

	const idbAbortController = new AbortController();
	const timeout = window.setTimeout(() => idbAbortController.abort(), 5000);

	const idbPromises = ['MisskeyClient'].map((name, i, arr) => new Promise<void>((res, rej) => {
		const delidb = indexedDB.deleteDatabase(name);
		delidb.onsuccess = () => res();
		delidb.onerror = e => rej(e);
		delidb.onblocked = () => idbAbortController.signal.aborted && rej(new Error('Operation aborted'));
	}));

	try {
		await Promise.race([
			Promise.all([
				...idbPromises,
				// idb keyval-storeはidb-keyvalライブラリによる別管理
				clear(),
			]),
			new Promise((_, rej) => idbAbortController.signal.addEventListener('abort', () => rej(new Error('Operation timed out')))),
		]);
	} catch {
		// nothing
	} finally {
		window.clearTimeout(timeout);
	}

	//#region Remove service worker registration
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		const subscriptions = (await Promise.all(registrations.map(registration =>
			registration.pushManager.getSubscription().catch(() => null),
		))).filter((push): push is PushSubscription => push != null);

		for (const push of subscriptions) {
			try {
				await window.fetch(`${apiUrl}/sw/unregister`, {
					method: 'POST',
					body: JSON.stringify({
						i: $i.token,
						endpoint: push.endpoint,
					}),
					headers: {
						'Content-Type': 'application/json',
					},
				});
			} finally {
				// Remove the browser-side subscription as well. Otherwise the next
				// account can inherit an endpoint that still belongs to this one.
				await push.unsubscribe().catch(() => undefined);
			}
		}

		await Promise.all(registrations.map(registration => registration.unregister()));
	} catch {
		// nothing
	}
	//#endregion

	unisonReload('/');
}
