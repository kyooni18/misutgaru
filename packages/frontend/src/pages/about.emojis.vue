<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAboutEmojis :q="q" :searchEmojis="searchEmojis" :customEmojis="customEmojis" :categories="customEmojiCategories" :canManage="!!($i && ($i.isModerator || $i.policies.canManageCustomEmojis))" :emojisClass="$style.emojis" :onQChange="(value: string) => q = value"/>
</template>

<script lang="ts" setup>
import VuneAboutEmojis from '@/pages/vune/about-emojis.vune?vue-host';
import { watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { customEmojis, customEmojiCategories } from '@/custom-emojis.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';

const q = ref('');
const searchEmojis = ref<Misskey.entities.EmojiSimple[] | null>(null);

function search() {
	if (q.value === '' || q.value == null) {
		searchEmojis.value = null;
		return;
	}

	const queryarry = q.value.match(/\:([a-z0-9_]*)\:/g);

	if (queryarry) {
		searchEmojis.value = customEmojis.value.filter(emoji =>
			queryarry.includes(`:${emoji.name}:`),
		);
	} else {
		searchEmojis.value = customEmojis.value.filter(emoji => emoji.name.includes(q.value) || emoji.aliases.includes(q.value));
	}
}

watch(q, () => {
	search();
});
</script>

<style lang="scss" module>
.emojis {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
	grid-gap: 12px;
}
</style>
