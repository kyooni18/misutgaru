<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<div v-for="child in children" :key="child.id" :class="$style.item">
		<!-- the note draws its avatar line only when followed by replies, joining the guide line below -->
		<MkNoteDetailed
			:note="child"
			:threadContext="true"
			:showControls="true"
			:showAdditionalLayout="false"
		/>
		<MkNoteThreadTree
			v-if="child.repliesCount > 0 && depth < maxDepth"
			:class="$style.nested"
			:noteId="child.id"
			:depth="depth + 1"
			:maxDepth="maxDepth"
		/>
		<div v-else-if="child.repliesCount > 0" :class="$style.more">
			<MkA class="_link" :to="notePage(child)">{{ i18n.ts.continueThread }} <i class="ti ti-chevron-double-right"></i></MkA>
		</div>
	</div>
	<div v-if="loading" :class="$style.loading"><MkLoading mini/></div>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { notePage } from '@/filters/note.js';
import { i18n } from '@/i18n.js';

// Recursively renders the replies of a note as a vertical tree feed.
const props = withDefaults(defineProps<{
	noteId: string;
	depth?: number;
	maxDepth?: number;
}>(), {
	depth: 1,
	maxDepth: 6,
});

const children = ref<Misskey.entities.Note[]>([]);
const loading = ref(true);

onMounted(() => {
	misskeyApi('notes/children', {
		noteId: props.noteId,
		limit: 30,
	}).then(res => {
		// chronological order
		children.value = res.toReversed();
	}).finally(() => {
		loading.value = false;
	});
});
</script>

<style lang="scss" module>
.root {
	display: block;
	--MI-threadIndent: 32px;
}

.item {
	position: relative;
	border-top: solid 1px var(--MI-hairline);
}

// replies hang off a guide line dropped from the parent's avatar centre
.nested, .more {
	margin-left: calc(var(--MI-threadIndent) + 20px);
}

.more {
	border-left: solid 2px var(--MI-hairlineStrong);
}

.nested {
	--MI-threadPad: 16px;
	--MI-threadIndent: 16px;

	// each reply carries its own segment of the guide line; the last one
	// stops at its avatar with a curved elbow instead of running to the bottom
	> .item::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-left: solid 2px var(--MI-hairlineStrong);
		pointer-events: none;
	}

	> .item:last-of-type::before {
		bottom: auto;
		width: 12px;
		height: calc(16px + 21px);
		border-bottom: solid 2px var(--MI-hairlineStrong);
		border-bottom-left-radius: 12px;
	}

	&:empty {
		display: none;
	}

	.item:first-child {
		border-top: none;
	}
}

.more {
	padding: 10px 16px;
}

.loading {
	padding: 8px;
}

@container (max-width: 450px) {
	.root {
		--MI-threadIndent: 16px;
	}
}
</style>
