<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneWebhookEdit
	:props="{
		name,
		url,
		secret,
		active,
		eventFollow: event_follow,
		eventFollowed: event_followed,
		eventNote: event_note,
		eventReply: event_reply,
		eventRenote: event_renote,
		eventReaction: event_reaction,
		eventMention: event_mention,
		switchBoxClass: $style.switchBox,
		testButtonClass: $style.testButton,
		descriptionClass: $style.description,
		onName: updateName,
		onUrl: updateUrl,
		onSecret: updateSecret,
		onActive: updateActive,
		onEventFollow: updateEventFollow,
		onEventFollowed: updateEventFollowed,
		onEventNote: updateEventNote,
		onEventReply: updateEventReply,
		onEventRenote: updateEventRenote,
		onEventReaction: updateEventReaction,
		onEventMention: updateEventMention,
		onTest: test,
		onSave: save,
		onDelete: del,
	}"
/>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import VuneWebhookEditView from './vune/webhook.edit.vune';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneWebhookEdit = createVuneWebHost(VuneWebhookEditView);

const router = useRouter();

const props = defineProps<{
	webhookId: string;
}>();

const webhook = await misskeyApi('i/webhooks/show', {
	webhookId: props.webhookId,
});

const name = ref(webhook.name);
const url = ref(webhook.url);
const secret = ref(webhook.secret);
const active = ref(webhook.active);

const event_follow = ref(webhook.on.includes('follow'));
const event_followed = ref(webhook.on.includes('followed'));
const event_note = ref(webhook.on.includes('note'));
const event_reply = ref(webhook.on.includes('reply'));
const event_renote = ref(webhook.on.includes('renote'));
const event_reaction = ref(webhook.on.includes('reaction'));
const event_mention = ref(webhook.on.includes('mention'));

function updateName(value: string): void {
	name.value = value;
}

function updateUrl(value: string): void {
	url.value = value;
}

function updateSecret(value: string): void {
	secret.value = value;
}

function updateActive(value: boolean): void {
	active.value = value;
}

function updateEventFollow(value: boolean): void {
	event_follow.value = value;
}

function updateEventFollowed(value: boolean): void {
	event_followed.value = value;
}

function updateEventNote(value: boolean): void {
	event_note.value = value;
}

function updateEventReply(value: boolean): void {
	event_reply.value = value;
}

function updateEventRenote(value: boolean): void {
	event_renote.value = value;
}

function updateEventReaction(value: boolean): void {
	event_reaction.value = value;
}

function updateEventMention(value: boolean): void {
	event_mention.value = value;
}

function save() {
	const events: Misskey.entities.UserWebhook['on'] = [];
	if (event_follow.value) events.push('follow');
	if (event_followed.value) events.push('followed');
	if (event_note.value) events.push('note');
	if (event_reply.value) events.push('reply');
	if (event_renote.value) events.push('renote');
	if (event_reaction.value) events.push('reaction');
	if (event_mention.value) events.push('mention');

	os.apiWithDialog('i/webhooks/update', {
		name: name.value,
		url: url.value,
		secret: secret.value,
		webhookId: props.webhookId,
		on: events,
		active: active.value,
	});
}

async function del(): Promise<void> {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: webhook.name }),
	});
	if (canceled) return;

	await os.apiWithDialog('i/webhooks/delete', {
		webhookId: props.webhookId,
	});

	router.push('/settings/connect');
}

async function test(type: Misskey.entities.UserWebhook['on'][number]): Promise<void> {
	await os.apiWithDialog('i/webhooks/test', {
		webhookId: props.webhookId,
		type,
		override: {
			secret: secret.value,
			url: url.value,
		},
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: 'Edit webhook',
	icon: 'ti ti-webhook',
}));
</script>

<style module lang="scss">
.switchBox {
	display: flex;
	align-items: center;
	justify-content: start;

	.testButton {
		$buttonSize: 28px;
		padding: 0;
		width: $buttonSize;
		min-width: $buttonSize;
		max-width: $buttonSize;
		height: $buttonSize;
		margin-left: auto;
		line-height: inherit;
		font-size: 90%;
		border-radius: 9999px;
	}
}

.description {
	font-size: 0.85em;
	padding: 8px 0 0 0;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}
</style>
