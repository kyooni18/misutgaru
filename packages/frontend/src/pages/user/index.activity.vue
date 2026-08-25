<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserIndexActivity :user="user" :limit="limit" :chartSrc="chartSrc" :onMenu="showMenu"/>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import VuneUserIndexActivity from './vune/index.activity.vune.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	user: Misskey.entities.User;
	limit?: number;
}>(), {
	limit: 50,
});

const chartSrc = ref<'per-user-notes' | 'per-user-pv'>('per-user-notes');

function showMenu(ev: PointerEvent) {
	os.popupMenu([{
		text: i18n.ts.notes,
		active: chartSrc.value === 'per-user-notes',
		action: () => {
			chartSrc.value = 'per-user-notes';
		},
	}, {
		text: i18n.ts.numberOfProfileView,
		active: chartSrc.value === 'per-user-pv',
		action: () => {
			chartSrc.value = 'per-user-pv';
		},
	}, /*, {
		text: i18n.ts.following,
		action: () => {
			chartSrc = 'per-user-following';
		}
	}, {
		text: i18n.ts.followers,
		action: () => {
			chartSrc = 'per-user-followers';
		}
	}*/], ev.currentTarget ?? ev.target);
}
</script>
