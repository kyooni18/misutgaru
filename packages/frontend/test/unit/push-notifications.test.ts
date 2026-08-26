/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	detectPushPlatform,
	detectPushSupport,
	encodePushKey,
	getPushSubscriptionKeys,
	getOrCreatePushSubscription,
	pushSubscriptionUsesVapidKey,
	urlBase64ToUint8Array,
} from '@/utility/push-notifications.js';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function makeSubscription(applicationServerKey: ArrayBuffer | null): PushSubscription {
	return {
		options: {
			applicationServerKey,
			userVisibleOnly: true,
		},
		endpoint: 'https://push.example.test/subscription',
		expirationTime: null,
		getKey: () => null,
		toJSON: () => ({ endpoint: 'https://push.example.test/subscription' }),
		unsubscribe: vi.fn(async () => true),
	} as unknown as PushSubscription;
}

describe('push notification transport helpers', () => {
	test.each([
		['iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 0, 'ios'],
		['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l', 0, 'android'],
		['macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'MacIntel', 0, 'macos'],
		['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0, 'windows'],
		['Linux', 'Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64', 0, 'linux'],
	] as const)('detects the %s push platform', (_name, userAgent, platform, maxTouchPoints, expected) => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
		vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
		vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(maxTouchPoints);

		expect(detectPushPlatform()).toBe(expected);
	});

	test('requires Home Screen installation for iOS push', () => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
		vi.spyOn(navigator, 'platform', 'get').mockReturnValue('iPhone');
		vi.stubGlobal('isSecureContext', true);

		expect(detectPushSupport({ enableServiceWorker: true, swPublickey: 'AQID' })).toMatchObject({
			supported: false,
			reason: 'ios-install-required',
			requiresHomeScreenInstallation: true,
		});
	});

	test('decodes URL-safe VAPID keys and encodes subscription keys', () => {
		const key = urlBase64ToUint8Array('AQID-_w');
		expect(Array.from(key)).toEqual([1, 2, 3, 251, 252]);
		expect(encodePushKey(key.buffer)).toBe('AQID+/w=');
	});

	test('detects VAPID key rotation when the browser exposes the key', () => {
		const key = urlBase64ToUint8Array('AQID');
		const subscription = makeSubscription(key.buffer);

		expect(pushSubscriptionUsesVapidKey(subscription, 'AQID')).toBe(true);
		expect(pushSubscriptionUsesVapidKey(subscription, 'BAUG')).toBe(false);
	});

	test('rejects subscriptions without encryption keys', () => {
		expect(getPushSubscriptionKeys(makeSubscription(null))).toBeNull();
	});

	test('replaces a subscription created with a different VAPID key', async () => {
		const oldSubscription = makeSubscription(urlBase64ToUint8Array('AQID').buffer);
		const replacement = makeSubscription(urlBase64ToUint8Array('BAUG').buffer);
		const getSubscription = vi.fn(async () => oldSubscription);
		const subscribe = vi.fn(async () => replacement);
		const registration = {
			pushManager: {
				getSubscription,
				subscribe,
			},
		} as unknown as ServiceWorkerRegistration;

		await expect(getOrCreatePushSubscription(registration, 'BAUG')).resolves.toBe(replacement);
		expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce();
		expect(subscribe).toHaveBeenCalledWith({
			userVisibleOnly: true,
			applicationServerKey: expect.any(Uint8Array),
		});
	});

	test('remembers the VAPID key when the browser hides applicationServerKey', async () => {
		const storage = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		});
		const oldSubscription = makeSubscription(null);
		const replacement = makeSubscription(null);
		const firstRegistration = {
			pushManager: {
				getSubscription: vi.fn(async () => oldSubscription),
				subscribe: vi.fn(),
			},
		} as unknown as ServiceWorkerRegistration;
		await expect(getOrCreatePushSubscription(firstRegistration, 'AQID')).resolves.toBe(oldSubscription);
		expect(pushSubscriptionUsesVapidKey(oldSubscription, 'BAUG')).toBe(false);

		const secondRegistration = {
			pushManager: {
				getSubscription: vi.fn(async () => oldSubscription),
				subscribe: vi.fn(async () => replacement),
			},
		} as unknown as ServiceWorkerRegistration;
		await expect(getOrCreatePushSubscription(secondRegistration, 'BAUG')).resolves.toBe(replacement);
		expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce();
	});
});
