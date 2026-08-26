<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneInstanceMute
	:instanceMutes="instanceMutes"
	:changed="changed"
	:onChange="value => instanceMutes = value"
	:onSave="save"
/>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import VuneInstanceMute from './vune/mute-block.instance-mute.vune';
import { ensureSignin } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const $i = ensureSignin();

const instanceMutes = ref($i.mutedInstances.join('\n'));
const changed = ref(false);

async function save() {
	let mutes = instanceMutes.value
		.trim().split('\n')
		.map(el => el.trim())
		.filter(el => el);

	await misskeyApi('i/update', {
		mutedInstances: mutes,
	});

	changed.value = false;

	// Refresh filtered list to signal to the user how they've been saved
	instanceMutes.value = mutes.join('\n');
}

watch(instanceMutes, () => {
	changed.value = true;
});
</script>
