<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" class="_gaps">
	<div class="_gaps">
		<XNote v-for="note in notes" :key="`${note.id}_1`" :note="note"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import { ref } from 'vue';
import XNote from '@/pages/welcome.timeline.note.vue';
import { misskeyApiGet } from '@/utility/misskey-api.js';

const notes = ref<Misskey.entities.Note[]>([]);

misskeyApiGet('notes/featured').then(_notes => {
	notes.value = _notes;
});
</script>

<style lang="scss" module>
.root {
	text-align: right;
	contain: layout paint;
}
</style>
