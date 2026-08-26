/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Encode a PushSubscription key as the base64 string expected by the API. */
export function encodePushSubscriptionKey(buffer: ArrayBuffer | null): string {
	if (buffer == null) return '';

	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return globalThis.btoa(binary);
}

export function getPushSubscriptionKeys(subscription: PushSubscription): { auth: string; publickey: string } | null {
	const auth = subscription.getKey('auth');
	const publickey = subscription.getKey('p256dh');
	if (auth == null || publickey == null) return null;

	return {
		auth: encodePushSubscriptionKey(auth),
		publickey: encodePushSubscriptionKey(publickey),
	};
}
