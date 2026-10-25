<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<Transition :name="prefer.s.animation ? 'fade' : ''" mode="out-in">
			<div v-if="note" :class="$style.threadViewport">
				<div class="_margin _gaps_s">
					<MkRemoteCaution v-if="note.user.host != null" :href="note.url ?? note.uri"/>
					<MkNoteDetailed :key="note.id" v-model:note="note" :initialTab="initialTab" :autoLoadThread="true" :focusNote="true" :class="$style.note"/>
				</div>
			</div>
			<MkError v-else-if="error" @retry="fetchNote()"/>
			<MkLoading v-else/>
		</Transition>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { host } from '@@/js/config.js';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import MkRemoteCaution from '@/components/MkRemoteCaution.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { dateString } from '@/filters/date.js';
import { prefer } from '@/preferences.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { serverContext, assertServerContext } from '@/server-context.js';
import { $i } from '@/i.js';

// contextは非ログイン状態の情報しかないためログイン時は利用できない
const CTX_NOTE = !$i && assertServerContext(serverContext, 'note') ? serverContext.note : null;

const props = defineProps<{
	noteId: string;
	initialTab?: string;
}>();

const note = ref<null | Misskey.entities.Note>(CTX_NOTE);
const initialTab = computed<'reactions' | 'replies' | 'renotes' | undefined>(() => {
	if (['reactions', 'replies', 'renotes'].includes(props.initialTab ?? '')) {
		return props.initialTab as 'reactions' | 'replies' | 'renotes';
	}
	return undefined;
});
const error = ref();

function fetchNote() {
	note.value = null;
	error.value = null;
	const noteId = props.noteId;

	if (CTX_NOTE && CTX_NOTE.id === noteId) {
		note.value = CTX_NOTE;
		return;
	}

	misskeyApi('notes/show', {
		noteId,
	}).then(res => {
		if (props.noteId !== noteId) return;
		note.value = res;
	}).catch(err => {
		if (props.noteId !== noteId) return;
		if (['fbcc002d-37d9-4944-a6b0-d9e29f2d33ab', '145f88d2-b03d-4087-8143-a78928883c4b'].includes(err.id)) {
			pleaseLogin({
				path: '/',
				message: err.id === 'fbcc002d-37d9-4944-a6b0-d9e29f2d33ab' ? i18n.ts.thisContentsAreMarkedAsSigninRequiredByAuthor : i18n.ts.signinOrContinueOnRemote,
				openOnRemote: {
					type: 'lookup',
					url: `https://${host}/notes/${noteId}`,
				},
			});
		}
		error.value = err;
	});
}

watch(() => props.noteId, fetchNote, {
	immediate: true,
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.note,
	...note.value ? {
		subtitle: dateString(note.value.createdAt),
		avatar: note.value.user,
		path: `/notes/${note.value.id}`,
		share: {
			title: i18n.tsx.noteOf({ user: note.value.user.name ?? note.value.user.username }),
			text: note.value.text,
		},
	} : {},
}));
</script>

<style lang="scss" module>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.threadViewport {
	// Leave enough scroll range to center a note even when it has no ancestors or replies.
	padding-block: 50vh;
}

.note {
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
}
</style>
