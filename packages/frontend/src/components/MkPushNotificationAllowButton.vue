<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkButton
	v-if="supported && !pushRegistrationInServer"
	type="button"
	primary
	:gradate="gradate"
	:rounded="rounded"
	:inline="inline"
	:autofocus="autofocus"
	:wait="wait"
	:full="full"
	@click="subscribe"
>
	{{ i18n.ts.subscribePushNotification }}
</MkButton>
<MkButton
	v-else-if="!showOnlyToRegister && ($i ? pushRegistrationInServer : pushSubscription)"
	type="button"
	:primary="false"
	:gradate="gradate"
	:rounded="rounded"
	:inline="inline"
	:autofocus="autofocus"
	:wait="wait"
	:full="full"
	@click="unsubscribe"
>
	{{ i18n.ts.unsubscribePushNotification }}
</MkButton>
<MkButton v-else-if="$i && pushRegistrationInServer" disabled :rounded="rounded" :inline="inline" :wait="wait" :full="full">
	{{ i18n.ts.pushNotificationAlreadySubscribed }}
</MkButton>
<MkButton v-else-if="!supported" disabled :rounded="rounded" :inline="inline" :wait="wait" :full="full">
	{{ i18n.ts.pushNotificationNotSupported }}
</MkButton>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { instanceName } from '@@/js/config.js';
import { $i } from '@/i.js';
import MkButton from '@/components/MkButton.vue';
import { instance } from '@/instance.js';
import { apiWithDialog, promiseDialog, alert } from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { getAccounts } from '@/accounts.js';
import {
	detectPushSupport,
	getPushSubscriptionKeys,
	getOrCreatePushSubscription,
	pushSubscriptionUsesVapidKey,
	waitForPushServiceWorker,
} from '@/utility/push-notifications.js';

defineProps<{
	primary?: boolean;
	gradate?: boolean;
	rounded?: boolean;
	inline?: boolean;
	link?: boolean;
	to?: string;
	autofocus?: boolean;
	wait?: boolean;
	danger?: boolean;
	full?: boolean;
	showOnlyToRegister?: boolean;
}>();

// ServiceWorker registration
const registration = ref<ServiceWorkerRegistration | undefined>();
// If this browser supports push notification
const supported = ref(false);
// If this browser has already subscribed to push notification
const pushSubscription = ref<PushSubscription | null>(null);
const pushRegistrationInServer = ref<{ state?: string; key?: string; userId: string; endpoint: string; sendReadMessage: boolean; } | undefined>();

async function subscribe() {
	if (!registration.value || !supported.value || !instance.swPublickey) return;

	if ('Notification' in window) {
		let permission = Notification.permission;

		if (Notification.permission === 'default') {
			permission = await promiseDialog(Notification.requestPermission(), null, null, i18n.ts.pleaseAllowPushNotification);
		}

		if (permission !== 'granted') {
			alert({
				type: 'error',
				title: i18n.ts.browserPushNotificationDisabled,
				text: i18n.tsx.browserPushNotificationDisabledDescription({ serverName: instanceName }),
			});
			return;
		}
	}

	try {
		// SEE: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe#Parameters
		// Reuse an existing subscription unless the instance rotated its VAPID key.
		const subscription = await getOrCreatePushSubscription(registration.value, instance.swPublickey);
		pushSubscription.value = subscription;
		const keys = getPushSubscriptionKeys(subscription);
		if (!keys) {
			await subscription.unsubscribe().catch(() => undefined);
			pushSubscription.value = null;
			throw new Error('The push service did not provide encryption keys.');
		}

		// Register the browser endpoint only after PushManager has accepted it.
		pushRegistrationInServer.value = await misskeyApi('sw/register', {
			endpoint: subscription.endpoint,
			auth: keys.auth,
			publickey: keys.publickey,
		});
	} catch (err: any) {
		if (err?.name === 'NotAllowedError') {
			console.info('User denied the notification permission request.');
			return;
		}

		alert({
			type: 'error',
			title: i18n.ts.somethingHappened,
			text: i18n.ts.pushNotificationNotSupported,
		});
	}
}

async function unsubscribe() {
	if (!pushSubscription.value) return;

	const endpoint = pushSubscription.value.endpoint;
	const accounts = await getAccounts();

	pushRegistrationInServer.value = undefined;

	if ($i && accounts.length >= 2) {
		await apiWithDialog('sw/unregister', {
			endpoint,
		}, $i.token);
		// Keep the browser subscription for other accounts, but let this
		// component expose the subscribe action for the current account again.
		pushSubscription.value = null;
	} else {
		await pushSubscription.value.unsubscribe();
		await apiWithDialog('sw/unregister', {
			endpoint,
		}, null);
		pushSubscription.value = null;
	}
}

async function initializePushState() {
	const support = detectPushSupport(instance);
	if (!support.supported || !$i?.token || !instance.swPublickey) return;

	try {
		const swr = await waitForPushServiceWorker();
		registration.value = swr;
		pushSubscription.value = await swr.pushManager.getSubscription();

		// A VAPID rotation invalidates subscriptions created with the old public
		// key. Remove that local/server registration now so the subscribe action
		// remains available instead of being hidden by show-registration.
		if (pushSubscription.value && !pushSubscriptionUsesVapidKey(pushSubscription.value, instance.swPublickey)) {
			const staleEndpoint = pushSubscription.value.endpoint;
			pushRegistrationInServer.value = undefined;
			await misskeyApi('sw/unregister', { endpoint: staleEndpoint }).catch(() => undefined);
			await pushSubscription.value.unsubscribe().catch(() => undefined);
			pushSubscription.value = null;
		}

		supported.value = true;

		if (pushSubscription.value) {
			const res = await misskeyApi('sw/show-registration', {
				endpoint: pushSubscription.value.endpoint,
			});
			if (res) pushRegistrationInServer.value = res;
		}
	} catch {
		// A worker can still be installing after the app first opens. The button
		// remains disabled until the next mount rather than showing a false
		// subscription state.
	}
}

void initializePushState();

defineExpose({
	pushRegistrationInServer: pushRegistrationInServer,
});
</script>
