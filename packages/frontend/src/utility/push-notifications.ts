/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * The browser Web Push API is the common push transport for the web app on
 * every supported desktop and mobile platform.  iOS/iPadOS exposes the same
 * API only to Home Screen web apps, so keep that requirement in one place
 * instead of spreading user-agent checks across components.
 */
export type PushPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';

export type PushSupportReason =
	| 'supported'
	| 'insecure-context'
	| 'ios-install-required'
	| 'service-worker-unavailable'
	| 'push-unavailable'
	| 'notifications-unavailable'
	| 'server-disabled';

export type PushSupport = {
	supported: boolean;
	platform: PushPlatform;
	reason: PushSupportReason;
	/** True when the user must install the PWA before retrying. */
	requiresHomeScreenInstallation: boolean;
};

type PushServerConfig = {
	enableServiceWorker?: boolean;
	swPublickey?: string | null;
};

const VAPID_PUBLIC_KEY_STORAGE = 'misskey.push.vapid-public-key';

type StandaloneNavigator = Navigator & {
	/** Safari's legacy Home Screen web-app flag. */
	standalone?: boolean;
};

function getUserAgent(): string {
	if (typeof navigator === 'undefined') return '';
	return `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
}

export function detectPushPlatform(): PushPlatform {
	const userAgent = getUserAgent();
	if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
	// iPadOS 13+ reports itself as Macintosh while exposing touch points.
	if (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
	if (/android/.test(userAgent)) return 'android';
	if (/macintosh|mac os x/.test(userAgent)) return 'macos';
	if (/windows/.test(userAgent)) return 'windows';
	if (/linux/.test(userAgent)) return 'linux';
	return 'other';
}

export function isStandalonePushApp(): boolean {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

	const legacyStandalone = (navigator as StandaloneNavigator).standalone === true;
	const displayModeStandalone = typeof window.matchMedia === 'function'
		&& window.matchMedia('(display-mode: standalone)').matches;
	return legacyStandalone || displayModeStandalone;
}

function isSecurePushContext(): boolean {
	if (typeof globalThis.isSecureContext === 'boolean') return globalThis.isSecureContext;
	if (typeof window === 'undefined') return false;
	return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function unsupported(
	platform: PushPlatform,
	reason: Exclude<PushSupportReason, 'supported'>,
	requiresHomeScreenInstallation = false,
): PushSupport {
	return {
		supported: false,
		platform,
		reason,
		requiresHomeScreenInstallation,
	};
}

export function detectPushSupport(config: PushServerConfig = {}): PushSupport {
	const platform = detectPushPlatform();

	if (!isSecurePushContext()) return unsupported(platform, 'insecure-context');
	if (config.enableServiceWorker === false || !config.swPublickey) return unsupported(platform, 'server-disabled');

	if (platform === 'ios' && !isStandalonePushApp()) {
		return unsupported(platform, 'ios-install-required', true);
	}

	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		return unsupported(platform, 'service-worker-unavailable');
	}
	if (typeof globalThis.PushManager === 'undefined') return unsupported(platform, 'push-unavailable');
	if (typeof globalThis.Notification === 'undefined') return unsupported(platform, 'notifications-unavailable');

	return {
		supported: true,
		platform,
		reason: 'supported',
		requiresHomeScreenInstallation: false,
	};
}

export async function waitForPushServiceWorker(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		throw new Error('Service workers are not available in this browser.');
	}

	let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
	try {
		return await Promise.race([
			navigator.serviceWorker.ready,
			new Promise<never>((_, reject) => {
				timeout = globalThis.setTimeout(() => reject(new Error('Timed out waiting for the push service worker.')), timeoutMs);
			}),
		]);
	} finally {
		if (timeout !== undefined) globalThis.clearTimeout(timeout);
	}
}

/** Convert a URL-safe base64 VAPID key into the byte array required by PushManager. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
	const rawData = globalThis.atob(base64);
	const outputArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(rawData.length));

	for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
}

/** Encode a PushSubscription key without using a spread (large keys can overflow the call stack). */
export function encodePushKey(buffer: ArrayBuffer | null): string {
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
		auth: encodePushKey(auth),
		publickey: encodePushKey(publickey),
	};
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	return a.every((value, index) => value === b[index]);
}

function getRememberedVapidPublicKey(): string | null {
	try {
		return globalThis.localStorage?.getItem(VAPID_PUBLIC_KEY_STORAGE) ?? null;
	} catch {
		return null;
	}
}

function rememberVapidPublicKey(publicKey: string): void {
	try {
		globalThis.localStorage?.setItem(VAPID_PUBLIC_KEY_STORAGE, publicKey);
	} catch {
		// Storage can be unavailable in private browsing modes.
	}
}

/**
 * Detect a VAPID key rotation.  Some implementations do not expose the key
 * used to create an existing subscription; in that case retaining the
 * subscription is safer than silently dropping a working registration.
 */
export function pushSubscriptionUsesVapidKey(subscription: PushSubscription, publicKey: string): boolean {
	const configuredKey = subscription.options.applicationServerKey;
	if (configuredKey == null) {
		const rememberedKey = getRememberedVapidPublicKey();
		if (rememberedKey == null) return true;
		try {
			return bytesEqual(urlBase64ToUint8Array(rememberedKey), urlBase64ToUint8Array(publicKey));
		} catch {
			return rememberedKey === publicKey;
		}
	}

	const configuredBytes = new Uint8Array(configuredKey);
	return bytesEqual(configuredBytes, urlBase64ToUint8Array(publicKey));
}

/**
 * Reuse a subscription when possible, replacing it when the instance rotated
 * its VAPID key.  This is important after an administrator regenerates keys:
 * PushManager otherwise returns a subscription that the server can no longer
 * send to.
 */
export async function getOrCreatePushSubscription(
	registration: ServiceWorkerRegistration,
	publicKey: string,
): Promise<PushSubscription> {
	let subscription = await registration.pushManager.getSubscription();
	if (subscription && !pushSubscriptionUsesVapidKey(subscription, publicKey)) {
		await subscription.unsubscribe();
		subscription = null;
	}

	const result = subscription ?? await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey),
	});
	rememberVapidPublicKey(publicKey);
	return result;
}
