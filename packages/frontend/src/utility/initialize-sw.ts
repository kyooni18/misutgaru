/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lang } from '@@/js/config.js';
import { syncServiceWorkerAccounts } from '@/utility/sync-service-worker-accounts.js';

export async function initializeSw() {
	if (!('serviceWorker' in navigator)) return;

	await syncServiceWorkerAccounts().catch(() => {
		// Notification clicks can still open the app if IndexedDB is unavailable.
	});

	// Do not let an old cached worker keep handling pushes after a deployment.
	// `updateViaCache: 'none'` is supported by modern desktop and mobile
	// browsers, including iOS Home Screen web apps.
	let registration: ServiceWorkerRegistration;
	try {
		registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/',
			type: 'classic',
			updateViaCache: 'none',
		});
	} catch (error) {
		if (_DEV_) console.warn('ServiceWorker registration failed', error);
		return;
	}
	await registration.update().catch(() => {
		// A transient offline update failure must not prevent the existing worker
		// from serving cached pages or receiving pushes.
	});

	navigator.serviceWorker.ready.then(registration => {
		registration.active?.postMessage({
			msg: 'initialize',
			lang,
		});
	}).catch(() => {
		// ServiceWorker.ready can reject when the browser is shutting down.
	});
}
