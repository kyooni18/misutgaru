<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeChannelFollowButton :isFollowing="isFollowing" :wait="wait" :full="full" :onClick="onClick"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VuneChannelFollowButton from './vune/MkChannelFollowButton.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';

const props = withDefaults(defineProps<{
	channel: Misskey.entities.Channel;
	full?: boolean;
}>(), {
	full: false,
});

const isFollowing = ref(props.channel.isFollowing);
const wait = ref(false);
const NativeChannelFollowButton = createVuneWebHost(VuneChannelFollowButton);

async function onClick() {
	wait.value = true;

	try {
		if (isFollowing.value) {
			await misskeyApi('channels/unfollow', {
				channelId: props.channel.id,
			});
			isFollowing.value = false;
		} else {
			await misskeyApi('channels/follow', {
				channelId: props.channel.id,
			});
			isFollowing.value = true;
		}
	} catch (err) {
		console.error(err);
	} finally {
		wait.value = false;
	}
}
</script>
