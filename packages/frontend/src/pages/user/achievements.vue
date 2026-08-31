<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserAchievementsHost :user="user" :withDescription="$i != null && (props.user.id === $i.id)"/>
</template>

<script lang="ts" setup>
import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';
import * as Misskey from 'misskey-js';
import VuneUserAchievements from './vune/achievements.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { claimAchievement } from '@/utility/achievements.js';
import { $i } from '@/i.js';

const VuneUserAchievementsHost = createVuneWebHost(VuneUserAchievements);

const props = defineProps<{
	user: Misskey.entities.User;
}>();

let timer: number | null;

function viewAchievements3min() {
	if ($i && (props.user.id === $i.id)) {
		claimAchievement('viewAchievements3min');
	}
}

onMounted(() => {
	if (timer == null) timer = window.setTimeout(viewAchievements3min, 1000 * 60 * 3);
});

onUnmounted(() => {
	if (timer != null) {
		window.clearTimeout(timer);
		timer = null;
	}
});

onActivated(() => {
	if (timer == null) timer = window.setTimeout(viewAchievements3min, 1000 * 60 * 3);
});

onDeactivated(() => {
	if (timer != null) {
		window.clearTimeout(timer);
		timer = null;
	}
});
</script>

<style lang="scss" module>

</style>
