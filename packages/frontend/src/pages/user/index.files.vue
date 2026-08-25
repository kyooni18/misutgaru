<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneUserIndexFiles :fetching="fetching" :notes="notes" :rootClass="$style.root" :streamClass="$style.stream" :onShowMore="() => emit('showMore')"/>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import VuneUserIndexFiles from './vune/index.files.vune.js';

const props = defineProps<{
	user: Misskey.entities.UserDetailed;
}>();

const emit = defineEmits<{
	(ev: 'showMore'): void;
}>();

const fetching = ref(true);
const notes = ref<Misskey.entities.Note[]>([]);

onMounted(() => {
	misskeyApi('users/notes', {
		userId: props.user.id,
		withFiles: true,
		limit: 10,
	}).then(_notes => {
		notes.value = _notes;
		fetching.value = false;
	});
});
</script>

<style lang="scss" module>
.root {
	padding: 8px;
}

.stream {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	grid-gap: 6px;

	>:nth-child(n+9) {
		display: none;
	}
}
</style>
