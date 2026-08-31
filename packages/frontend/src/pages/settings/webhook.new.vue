<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneWebhookNew
	:props="{
		name,
		url,
		secret,
		eventFollow: event_follow,
		eventFollowed: event_followed,
		eventNote: event_note,
		eventReply: event_reply,
		eventRenote: event_renote,
		eventReaction: event_reaction,
		eventMention: event_mention,
		onName: updateName,
		onUrl: updateUrl,
		onSecret: updateSecret,
		onEventFollow: updateEventFollow,
		onEventFollowed: updateEventFollowed,
		onEventNote: updateEventNote,
		onEventReply: updateEventReply,
		onEventRenote: updateEventRenote,
		onEventReaction: updateEventReaction,
		onEventMention: updateEventMention,
		onCreate: create,
	}"
/>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import VuneWebhookNewView from './vune/webhook.new.vune';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { definePage } from '@/page.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneWebhookNew = createVuneWebHost(VuneWebhookNewView);

const name = ref('');
const url = ref('');
const secret = ref('');

const event_follow = ref(true);
const event_followed = ref(true);
const event_note = ref(true);
const event_reply = ref(true);
const event_renote = ref(true);
const event_reaction = ref(true);
const event_mention = ref(true);

function updateName(value: string): void {
	name.value = value;
}

function updateUrl(value: string): void {
	url.value = value;
}

function updateSecret(value: string): void {
	secret.value = value;
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

async function create(): Promise<void> {
	const events = [] as Misskey.entities.UserWebhook['on'];
	if (event_follow.value) events.push('follow');
	if (event_followed.value) events.push('followed');
	if (event_note.value) events.push('note');
	if (event_reply.value) events.push('reply');
	if (event_renote.value) events.push('renote');
	if (event_reaction.value) events.push('reaction');
	if (event_mention.value) events.push('mention');

	os.apiWithDialog('i/webhooks/create', {
		name: name.value,
		url: url.value,
		secret: secret.value,
		on: events,
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: 'Create new webhook',
	icon: 'ti ti-webhook',
}));
</script>
