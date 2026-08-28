<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	v-if="!muted && !hideByPlugin && !isDeleted"
	ref="rootEl"
	v-hotkey="keymap"
	:class="$style.root"
	tabindex="0"
>
	<div v-if="!props.threadContext && appearNote.replyId && (props.autoLoadThread || (appearNote.reply && appearNote.reply.replyId))">
		<div v-if="!conversationLoaded" style="padding: 16px">
			<MkLoading v-if="conversationLoading" mini/>
			<MkButton v-else style="margin: 0 auto;" primary rounded @click="loadConversation">{{ i18n.ts.loadConversation }}</MkButton>
		</div>
		<MkNoteDetailed
			v-for="note in conversation"
			:key="note.id"
			:note="note"
			:threadContext="true"
			:showReplyButton="false"
			:allowReply="false"
			:showAdditionalLayout="false"
		/>
	</div>
	<MkNoteDetailed
		v-if="!props.threadContext && props.autoLoadThread && appearNote.replyId && appearNote.reply"
		:note="appearNote.reply"
		:threadContext="true"
		:showReplyButton="false"
		:allowReply="false"
		:showAdditionalLayout="false"
	/>
	<MkNoteSub v-else-if="!props.threadContext && appearNote.replyId && appearNote.reply" :note="appearNote.reply" :class="$style.replyTo"/>
	<div v-if="isRenote" :class="$style.renote">
		<MkAvatar :class="$style.renoteAvatar" :user="note.user" link preview/>
		<i class="ti ti-repeat" style="margin-right: 4px;"></i>
		<span :class="$style.renoteText">
			<I18n :src="i18n.ts.renotedBy" tag="span">
				<template #user>
					<MkA v-user-preview="note.userId" :class="$style.renoteName" :to="userPage(note.user)">
						<MkUserName :user="note.user"/>
					</MkA>
				</template>
			</I18n>
		</span>
		<div :class="$style.renoteInfo">
			<button ref="renoteTime" class="_button" :class="$style.renoteTime" @mousedown.prevent="showRenoteMenu()">
				<i v-if="isMyRenote" class="ti ti-dots" style="margin-right: 4px;"></i>
				<MkTime :time="note.createdAt"/>
			</button>
			<span v-if="note.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[note.visibility]">
				<i v-if="note.visibility === 'home'" class="ti ti-home"></i>
				<i v-else-if="note.visibility === 'followers'" class="ti ti-lock"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" class="ti ti-mail"></i>
			</span>
			<span v-if="note.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ti ti-rocket-off"></i></span>
		</div>
	</div>
	<div v-if="isRenote && note.renote == null" :class="$style.deleted">
		{{ i18n.ts.deletedNote }}
	</div>
	<template v-else>
		<article :class="$style.note" @contextmenu.stop="onContextmenu">
			<MkNoteDetailedContent
				ref="contentEl"
				v-model:showContent="showContent"
				:appearNote="appearNote"
				:reactiveNote="$appearNote"
				:parsed="parsed"
				:urls="urls"
				:translating="translating"
				:translation="translation"
				:showTicker="Boolean(showTicker)"
			/>
			<MkNoteDetailedControls
				v-if="showControls"
				:appearNote="appearNote"
				:reactiveNote="$appearNote"
				:canRenote="canRenote"
				:showReplyButton="showReplyButton"
				:showClipButton="prefer.s.showClipButtonInNoteFooter"
				:buttonRefs="controlRefs"
				:onReply="reply"
				:onRenote="renote"
				:onToggleReact="toggleReact"
				:onClip="clip"
				:onMenu="showMenu"
			/>
		</article>
		<section v-if="showContinuation && repliesLoaded && replies.length > 0" :class="$style.continuation" :aria-label="i18n.ts.replies">
			<MkNoteDetailed
				v-for="child in continuation"
				:key="child.id"
				:note="child"
				:threadContext="true"
				:showReplyButton="false"
				:allowReply="false"
				:showAdditionalLayout="false"
			/>
		</section>
		<div v-if="showAdditionalLayout" :class="$style.tabs">
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'replies' }]" @click="tab = 'replies'"><i class="ti ti-arrow-back-up"></i> {{ i18n.ts.replies }}</button>
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'renotes' }]" @click="tab = 'renotes'"><i class="ti ti-repeat"></i> {{ i18n.ts.renotes }}</button>
			<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'reactions' }]" @click="tab = 'reactions'"><i class="ti ti-icons"></i> {{ i18n.ts.reactions }}</button>
		</div>
		<div v-if="showAdditionalLayout">
			<div v-if="tab === 'replies'">
				<div v-if="!repliesLoaded" style="padding: 16px">
					<MkLoading v-if="repliesLoading" mini/>
					<MkButton v-else style="margin: 0 auto;" primary rounded @click="loadReplies">{{ i18n.ts.loadReplies }}</MkButton>
				</div>
				<MkNoteSub v-for="note in replies" :key="note.id" :note="note" :class="$style.reply" :detail="true"/>
			</div>
			<div v-else-if="tab === 'renotes'" :class="$style.tab_renotes">
				<MkPagination :paginator="renotesPaginator" :forceDisableInfiniteScroll="true">
					<template #default="{ items }">
						<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
							<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
								<MkUserCardMini :user="item.user" :withChart="false"/>
							</MkA>
						</div>
					</template>
				</MkPagination>
			</div>
			<div v-else-if="tab === 'reactions'" :class="$style.tab_reactions">
				<div :class="$style.reactionTabs">
					<button v-for="reaction in Object.keys($appearNote.reactions)" :key="reaction" :class="[$style.reactionTab, { [$style.reactionTabActive]: reactionTabType === reaction }]" class="_button" @click="reactionTabType = reaction">
						<MkReactionIcon :reaction="reaction"/>
						<span style="margin-left: 4px;">{{ $appearNote.reactions[reaction] }}</span>
					</button>
				</div>
				<MkPagination v-if="reactionTabType" :key="reactionTabType" :paginator="reactionsPaginator" :forceDisableInfiniteScroll="true">
					<template #default="{ items }">
						<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
							<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
								<MkUserCardMini :user="item.user" :withChart="false"/>
							</MkA>
						</div>
					</template>
				</MkPagination>
			</div>
		</div>
	</template>
</div>
<div v-else-if="muted" class="_panel" :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { inject, provide, ref, useTemplateRef, markRaw, computed, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import { useNote } from '@/composables/use-note.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { userPage } from '@/filters/user.js';
import { Paginator } from '@/utility/paginator.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { DI } from '@/di.js';
import type { Keymap } from '@/utility/hotkey.js';
import type { MkNoteDetailedControlRefs } from '@/components/MkNoteDetailedControls.vue';

// コンポーネント外部の依存関係
import MkNoteSub from '@/components/MkNoteSub.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkButton from '@/components/MkButton.vue';
import MkNoteDetailedContent from '@/components/MkNoteDetailedContent.vue';
import MkNoteDetailedControls from '@/components/MkNoteDetailedControls.vue';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	initialTab?: 'replies' | 'renotes' | 'reactions';
	autoLoadThread?: boolean;
	threadContext?: boolean;
	showControls?: boolean;
	showReplyButton?: boolean;
	showAdditionalLayout?: boolean;
	allowReply?: boolean;
}>(), {
	initialTab: 'replies',
	autoLoadThread: false,
	threadContext: false,
	showControls: true,
	showReplyButton: true,
	showAdditionalLayout: true,
	allowReply: true,
});

// 周辺コンテキストのインジェクト
const inChannel = inject(DI.inChannel, null);

// Template Refsの定義
const rootEl = useTemplateRef('rootEl');
const menuButton = useTemplateRef<HTMLElement>('menuButton');
const renoteButton = useTemplateRef<HTMLElement>('renoteButton');
const renoteTime = useTemplateRef<HTMLElement>('renoteTime');
const reactButton = useTemplateRef<HTMLElement>('reactButton');
const clipButton = useTemplateRef<HTMLElement>('clipButton');
const contentEl = useTemplateRef<{ openGallery: () => void }>('contentEl');

const controlRefs: MkNoteDetailedControlRefs = {
	renoteButton,
	reactButton,
	clipButton,
	menuButton,
};

// コンポーサブルの呼び出し
const {
	note,
	appearNote,
	$appearNote,
	hideByPlugin,
	isRenote,
	showContent,
	isDeleted,
	translating,
	translation,
	muted,
	canRenote,
	isMyRenote,
	parsed,
	urls,
	showTicker,

	// 関数群
	renote,
	reply,
	react,
	reactViaMfmEmoji,
	toggleReact,
	onContextmenu,
	showMenu,
	clip,
	showRenoteMenu,
	blur,
} = useNote(props, {
	rootEl,
	menuButton,
	renoteButton,
	renoteTime,
	reactButton,
	clipButton,
}, {
	inChannel,
});

// provide
provide(DI.mfmEmojiReactCallback, reactViaMfmEmoji);

// MkNoteDetailed固有
const tab = ref(props.initialTab);
const reactionTabType = ref<string | null>(null);
const showControls = computed(() => props.showControls);
const showReplyButton = computed(() => props.showReplyButton);
const showAdditionalLayout = computed(() => props.showAdditionalLayout);
const allowReply = computed(() => props.allowReply);
const showContinuation = computed(() => props.autoLoadThread && !props.threadContext);

const renotesPaginator = markRaw(new Paginator('notes/renotes', {
	limit: 10,
	params: {
		noteId: appearNote.id,
	},
}));

const reactionsPaginator = markRaw(new Paginator('notes/reactions', {
	limit: 10,
	computedParams: computed(() => ({
		noteId: appearNote.id,
		type: reactionTabType.value,
	})),
}));

const replies = ref<Misskey.entities.Note[]>([]);
const repliesLoaded = ref(false);
const repliesLoading = ref(false);
const continuation = computed(() => replies.value.toReversed());

function loadReplies() {
	if (repliesLoaded.value || repliesLoading.value) return;
	repliesLoading.value = true;
	void misskeyApi('notes/children', {
		noteId: appearNote.id,
		limit: 30,
	}).then(res => {
		replies.value = res;
		repliesLoaded.value = true;
	}).finally(() => {
		repliesLoading.value = false;
	});
}

const conversation = ref<Misskey.entities.Note[]>([]);
const conversationLoaded = ref(false);
const conversationLoading = ref(false);

function loadConversation() {
	if (conversationLoaded.value || conversationLoading.value) return;
	if (appearNote.replyId == null) {
		conversationLoaded.value = true;
		return;
	}
	conversationLoading.value = true;
	void misskeyApi('notes/conversation', {
		noteId: appearNote.replyId,
	}).then(res => {
		conversation.value = res.reverse();
		conversationLoaded.value = true;
	}).finally(() => {
		conversationLoading.value = false;
	});
}

onMounted(() => {
	if (!props.autoLoadThread) return;
	loadConversation();
	loadReplies();
});

// キーボードショートカットマップ
const keymap = {
	'r': () => {
		if (!allowReply.value) return;
		reply();
	},
	'e|a|plus': () => react(),
	'q': () => renote(),
	'm': () => showMenu(),
	'c': () => {
		if (!prefer.s.showClipButtonInNoteFooter) return;
		clip();
	},
	'o': () => {
		contentEl.value?.openGallery();
	},
	'v|enter': () => {
		if (appearNote.cw != null) {
			showContent.value = !showContent.value;
		}
	},
	'esc': {
		allowRepeat: true,
		callback: () => blur(),
	},
} as const satisfies Keymap;
</script>

<style lang="scss" module>
.root {
	position: relative;
	transition: box-shadow 0.1s ease;
	overflow: clip;
	contain: content;

	&:focus-visible {
		outline: none;

		&::after {
			content: "";
			pointer-events: none;
			display: block;
			position: absolute;
			z-index: 10;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			margin: auto;
			width: calc(100% - 8px);
			height: calc(100% - 8px);
			border: dashed 2px var(--MI_THEME-focus);
			border-radius: var(--MI-radius);
			box-sizing: border-box;
		}
	}
}

.replyTo {
	opacity: 0.7;
	padding-bottom: 0;
}

.replyToMore {
	opacity: 0.7;
}

.renote {
	display: flex;
	align-items: center;
	padding: 16px 32px 8px 32px;
	line-height: 28px;
	white-space: pre;
	color: var(--MI_THEME-renote);
}

.renoteAvatar {
	flex-shrink: 0;
	display: inline-block;
	width: 28px;
	height: 28px;
	margin: 0 8px 0 0;
	border-radius: 6px;
}

.renoteText {
	overflow: hidden;
	flex-shrink: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.renoteName {
	font-weight: bold;
}

.renoteInfo {
	margin-left: auto;
	font-size: 0.9em;
}

.renoteTime {
	flex-shrink: 0;
	color: inherit;
}

.renote + .note {
	padding-top: 8px;
}

.note {
	padding: 32px;
	font-size: 1.2em;
}

.continuation {
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.reply:not(:first-child) {
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.tabs {
	border-top: solid 0.5px var(--MI_THEME-divider);
	border-bottom: solid 0.5px var(--MI_THEME-divider);
	display: flex;
}

.tab {
	flex: 1;
	padding: 12px 8px;
	border-top: solid 2px transparent;
	border-bottom: solid 2px transparent;
}

.tabActive {
	border-bottom: solid 2px var(--MI_THEME-accent);
}

.tab_renotes {
	padding: 16px;
}

.tab_reactions {
	padding: 16px;
}

.reactionTabs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-bottom: 8px;
}

.reactionTab {
	padding: 4px 6px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 6px;
}

.reactionTabActive {
	border-color: var(--MI_THEME-accent);
}

@container (max-width: 500px) {
	.root {
		font-size: 0.9em;
	}
}

@container (max-width: 450px) {
	.renote {
		padding: 8px 16px 0 16px;
	}

	.note {
		padding: 16px;
	}

}

@container (max-width: 300px) {
	.root {
		font-size: 0.825em;
	}
}

.muted {
	padding: 8px;
	text-align: center;
	opacity: 0.7;
}

.deleted {
	text-align: center;
	padding: 32px;
	margin: 6px 32px 32px;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}
</style>
