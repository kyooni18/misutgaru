<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<footer>
	<div :class="$style.noteFooterInfo">
		<MkA :to="notePage(appearNote)">
			<MkTime :time="appearNote.createdAt" mode="detail" colored/>
		</MkA>
		<span style="margin-left: 0.5em;">
			<span style="border: 1px solid var(--MI_THEME-divider); margin-right: 0.5em;"></span>
			<i v-if="appearNote.visibility === 'public'" class="ti ti-world"></i>
			<i v-else-if="appearNote.visibility === 'home'" class="ti ti-home"></i>
			<i v-else-if="appearNote.visibility === 'followers'" class="ti ti-lock"></i>
			<i v-else-if="appearNote.visibility === 'specified'" ref="specified" class="ti ti-mail"></i>
			<span style="margin-left: 0.3em;">{{ i18n.ts._visibility[appearNote.visibility] }}</span>
		</span>
	</div>
	<MkReactionsViewer
		v-if="appearNote.reactionAcceptance !== 'likeOnly'"
		style="margin-top: 6px;"
		:reactions="reactiveNote.reactions"
		:reactionEmojis="reactiveNote.reactionEmojis"
		:myReaction="reactiveNote.myReaction"
		:noteId="appearNote.id"
	/>
	<button
		v-if="showReplyButton"
		class="_button"
		:class="$style.noteFooterButton"
		:aria-label="i18n.ts.reply"
		@click="handleReply"
	>
		<i class="ti ti-arrow-back-up"></i>
		<p v-if="appearNote.repliesCount > 0" :class="$style.noteFooterButtonCount">{{ number(appearNote.repliesCount) }}</p>
	</button>
	<button
		v-if="canRenote"
		ref="renoteButton"
		class="_button"
		:class="$style.noteFooterButton"
		:aria-label="i18n.ts.renote"
		@mousedown.prevent="onRenote"
	>
		<i class="ti ti-repeat"></i>
		<p v-if="appearNote.renoteCount > 0" :class="$style.noteFooterButtonCount">{{ number(appearNote.renoteCount) }}</p>
	</button>
	<button v-else class="_button" :class="$style.noteFooterButton" :aria-label="i18n.ts.renote" disabled>
		<i class="ti ti-ban"></i>
	</button>
	<button
		ref="reactButton"
		class="_button"
		:class="$style.noteFooterButton"
		:aria-label="i18n.ts.reaction"
		@click="onToggleReact"
	>
		<i v-if="appearNote.reactionAcceptance === 'likeOnly' && reactiveNote.myReaction != null" class="ti ti-heart-filled" style="color: var(--MI_THEME-love);"></i>
		<i v-else-if="reactiveNote.myReaction != null" class="ti ti-minus" style="color: var(--MI_THEME-accent);"></i>
		<i v-else-if="appearNote.reactionAcceptance === 'likeOnly'" class="ti ti-heart"></i>
		<i v-else class="ti ti-plus"></i>
		<p v-if="(appearNote.reactionAcceptance === 'likeOnly' || prefer.s.showReactionsCount) && reactiveNote.reactionCount > 0" :class="$style.noteFooterButtonCount">{{ number(reactiveNote.reactionCount) }}</p>
	</button>
	<button
		v-if="showClipButton"
		ref="clipButton"
		class="_button"
		:class="$style.noteFooterButton"
		:aria-label="i18n.ts.clip"
		@mousedown.prevent="onClip"
	>
		<i class="ti ti-paperclip"></i>
	</button>
	<button
		ref="menuButton"
		class="_button"
		:class="$style.noteFooterButton"
		:aria-label="i18n.ts.more"
		@mousedown.prevent="onMenu"
	>
		<i class="ti ti-dots"></i>
	</button>
</footer>
</template>

<script lang="ts">
import type { Ref } from 'vue';

export type MkNoteDetailedControlRefs = {
	renoteButton: Ref<HTMLElement | null>;
	reactButton: Ref<HTMLElement | null>;
	clipButton: Ref<HTMLElement | null>;
	menuButton: Ref<HTMLElement | null>;
};
</script>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import type { ReactiveNoteData } from '@/composables/use-note-capture.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { notePage } from '@/filters/note.js';
import number from '@/filters/number.js';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';

const props = withDefaults(defineProps<{
	appearNote: Misskey.entities.Note;
	reactiveNote: ReactiveNoteData;
	canRenote: boolean;
	showReplyButton?: boolean;
	showClipButton?: boolean;
	buttonRefs: MkNoteDetailedControlRefs;
	onReply?: () => void;
	onRenote: () => void;
	onToggleReact: () => void;
	onClip: () => void;
	onMenu: () => void;
}>(), {
	showReplyButton: true,
	showClipButton: false,
});

const renoteButton = props.buttonRefs.renoteButton;
const reactButton = props.buttonRefs.reactButton;
const clipButton = props.buttonRefs.clipButton;
const menuButton = props.buttonRefs.menuButton;

function handleReply(): void {
	props.onReply?.();
}
</script>

<style lang="scss" module>
.noteFooterInfo {
	margin: 16px 0;
	opacity: 0.7;
	font-size: 0.9em;
}

.noteFooterButton {
	margin: 0;
	padding: 8px;
	opacity: 0.7;

	&:not(:last-child) {
		margin-right: 28px;
	}

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}
}

.noteFooterButtonCount {
	display: inline;
	margin: 0 0 0 8px;
	opacity: 0.7;

	&.reacted {
		color: var(--MI_THEME-accent);
	}
}

@container (max-width: 350px) {
	.noteFooterButton {
		&:not(:last-child) {
			margin-right: 18px;
		}
	}
}

@container (max-width: 300px) {
	.noteFooterButton {
		&:not(:last-child) {
			margin-right: 12px;
		}
	}
}
</style>
