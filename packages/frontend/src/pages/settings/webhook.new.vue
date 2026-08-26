<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneWebhookNew
	:name="name"
	:url="url"
	:secret="secret"
	:eventFollow="event_follow"
	:eventFollowed="event_followed"
	:eventNote="event_note"
	:eventReply="event_reply"
	:eventRenote="event_renote"
	:eventReaction="event_reaction"
	:eventMention="event_mention"
	:onName="value => name = value"
	:onUrl="value => url = value"
	:onSecret="value => secret = value"
	:onEventFollow="value => event_follow = value"
	:onEventFollowed="value => event_followed = value"
	:onEventNote="value => event_note = value"
	:onEventReply="value => event_reply = value"
	:onEventRenote="value => event_renote = value"
	:onEventReaction="value => event_reaction = value"
	:onEventMention="value => event_mention = value"
	:onCreate="create"
/>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import VuneWebhookNew from './vune/webhook.new.vune';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { definePage } from '@/page.js';

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
