<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<header :class="$style.noteHeader">
	<MkAvatar :class="$style.noteHeaderAvatar" :user="appearNote.user" indicator link preview/>
	<div :class="$style.noteHeaderBody">
		<div>
			<MkA v-user-preview="appearNote.user.id" :class="$style.noteHeaderName" :to="userPage(appearNote.user)">
				<MkUserName :nowrap="false" :user="appearNote.user"/>
			</MkA>
			<span v-if="appearNote.user.isBot" :class="$style.isBot">bot</span>
			<div :class="$style.noteHeaderInfo">
				<span v-if="appearNote.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[appearNote.visibility]">
					<i v-if="appearNote.visibility === 'home'" class="ti ti-home"></i>
					<i v-else-if="appearNote.visibility === 'followers'" class="ti ti-lock"></i>
					<i v-else-if="appearNote.visibility === 'specified'" ref="specified" class="ti ti-mail"></i>
				</span>
				<span v-if="appearNote.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ti ti-rocket-off"></i></span>
			</div>
		</div>
		<div :class="$style.noteHeaderUsernameAndBadgeRoles">
			<div :class="$style.noteHeaderUsername">
				<MkAcct :user="appearNote.user"/>
			</div>
			<div v-if="appearNote.user.badgeRoles" :class="$style.noteHeaderBadgeRoles">
				<img v-for="(role, i) in appearNote.user.badgeRoles" :key="i" v-tooltip="role.name" :class="$style.noteHeaderBadgeRole" :src="role.iconUrl!"/>
			</div>
		</div>
		<MkInstanceTicker v-if="showTicker" :host="appearNote.user.host" :instance="appearNote.user.instance"/>
	</div>
</header>
<div :class="$style.noteContent">
	<p v-if="appearNote.cw != null" :class="$style.cw">
		<Mfm
			v-if="appearNote.cw !== ''"
			:text="appearNote.cw"
			:author="appearNote.user"
			:nyaize="'respect'"
			:enableEmojiMenu="true"
			:enableEmojiMenuReaction="true"
		/>
		<MkCwButton v-model="showContent" :text="appearNote.text" :renote="appearNote.renote" :files="appearNote.files" :poll="appearNote.poll"/>
	</p>
	<div v-if="showCwMedia && appearNote.cw != null && !showContent && appearNote.files && appearNote.files.length > 0">
		<MkMediaList ref="galleryEl" :mediaList="appearNote.files" :user="appearNote.user" :forceShow="true"/>
	</div>
	<div v-show="appearNote.cw == null || showContent">
		<span v-if="appearNote.isHidden" style="opacity: 0.5">({{ i18n.ts.private }})</span>
		<MkA v-if="appearNote.replyId" :class="$style.noteReplyTarget" :to="`/notes/${appearNote.replyId}`"><i class="ti ti-arrow-back-up"></i></MkA>
		<Mfm
			v-if="appearNote.text"
			:parsedNodes="parsed"
			:text="appearNote.text"
			:author="appearNote.user"
			:nyaize="'respect'"
			:emojiUrls="appearNote.emojis"
			:enableEmojiMenu="true"
			:enableEmojiMenuReaction="true"
			class="_selectable"
		/>
		<a v-if="appearNote.renote != null" :class="$style.rn">RN:</a>
		<div v-if="translating || translation" :class="$style.translation">
			<MkLoading v-if="translating" mini/>
			<div v-else-if="translation">
				<b>{{ i18n.tsx.translatedFrom({ x: translation.sourceLang }) }}: </b>
				<Mfm :text="translation.text" :author="appearNote.user" :nyaize="'respect'" :emojiUrls="appearNote.emojis" class="_selectable"/>
				<template v-for="(image, index) in translation.images" :key="`${image.fileId}-${index}`">
					<div v-if="image.kind !== 'skip' && image.text" :class="$style.imageTranslation">
						<b>{{ image.kind === 'translation' ? i18n.ts.translate : i18n.ts.details }} #{{ index + 1 }}: </b>
						<Mfm :text="image.text" :author="appearNote.user" :nyaize="'respect'" :emojiUrls="appearNote.emojis" class="_selectable"/>
					</div>
				</template>
			</div>
		</div>
		<div v-if="(!showCwMedia || appearNote.cw == null || showContent) && appearNote.files && appearNote.files.length > 0">
			<MkMediaList ref="galleryEl" :mediaList="appearNote.files" :user="appearNote.user"/>
		</div>
		<MkPoll
			v-if="appearNote.poll"
			:noteId="appearNote.id"
			:multiple="appearNote.poll.multiple"
			:expiresAt="appearNote.poll.expiresAt"
			:choices="reactiveNote.pollChoices"
			:author="appearNote.user"
			:emojiUrls="appearNote.emojis"
			:class="$style.poll"
		/>
		<div v-if="isEnabledUrlPreview">
			<MkUrlPreview v-for="url in urls" :key="url" :url="url" :compact="true" :detail="true" style="margin-top: 6px;"/>
		</div>
		<div v-if="appearNote.renoteId" :class="$style.quote"><MkNoteSimple :note="appearNote.renote ?? null" :class="$style.quoteNote"/></div>
	</div>
	<MkA v-if="appearNote.channel && !inChannel" :class="$style.channel" :to="`/channels/${appearNote.channel.id}`"><i class="ti ti-device-tv"></i> {{ appearNote.channel.name }}</MkA>
</div>
</template>

<script lang="ts" setup>
import { computed, inject, useTemplateRef } from 'vue';
import * as mfm from 'mfm-js';
import * as Misskey from 'misskey-js';
import type { ReactiveNoteData } from '@/composables/use-note-capture.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { userPage } from '@/filters/user.js';
import { isEnabledUrlPreview } from '@/utility/url-preview.js';
import { DI } from '@/di.js';
import MkNoteSimple from '@/components/MkNoteSimple.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkInstanceTicker from '@/components/MkInstanceTicker.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import Mfm from '@/components/global/MkMfm.js';

defineProps<{
	appearNote: Misskey.entities.Note;
	reactiveNote: ReactiveNoteData;
	parsed: mfm.MfmNode[] | null;
	urls: readonly string[];
	translating: boolean;
	translation: Misskey.entities.NotesTranslateResponse | null;
	showTicker: boolean;
}>();

const showContent = defineModel<boolean>('showContent', { required: true });
const showCwMedia = computed(() => prefer.r.showCwMedia.value);
const inChannel = inject(DI.inChannel, null);
const galleryEl = useTemplateRef<{ openGallery: () => void }>('galleryEl');

function openGallery(): void {
	galleryEl.value?.openGallery();
}

defineExpose({ openGallery });
</script>

<style lang="scss" module>
.noteHeader {
	display: flex;
	position: relative;
	margin-bottom: 16px;
	align-items: center;
}

.noteHeaderAvatar {
	display: block;
	flex-shrink: 0;
	width: 58px;
	height: 58px;
}

.noteHeaderBody {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding-left: 16px;
	font-size: 0.95em;
}

.noteHeaderName {
	font-weight: bold;
	line-height: 1.3;
}

.isBot {
	display: inline-block;
	margin: 0 0.5em;
	padding: 4px 6px;
	font-size: 80%;
	line-height: 1;
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: 4px;
}

.noteHeaderInfo {
	float: right;
}

.noteHeaderUsernameAndBadgeRoles {
	display: flex;
}

.noteHeaderUsername {
	margin-bottom: 2px;
	margin-right: 0.5em;
	line-height: 1.3;
	word-wrap: anywhere;
}

.noteHeaderBadgeRoles {
	margin: 0 .5em 0 0;
}

.noteHeaderBadgeRole {
	height: 1.3em;
	vertical-align: -20%;

	& + .noteHeaderBadgeRole {
		margin-left: 0.2em;
	}
}

.noteContent {
	container-type: inline-size;
	overflow-wrap: break-word;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.noteReplyTarget {
	color: var(--MI_THEME-accent);
	margin-right: 0.5em;
}

.rn {
	margin-left: 4px;
	font-style: oblique;
	color: var(--MI_THEME-renote);
}

.translation {
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 12px;
	margin-top: 8px;
}

.imageTranslation {
	margin-top: 8px;
}

.poll {
	font-size: 80%;
}

.quote {
	padding: 8px 0;
}

.quoteNote {
	padding: 16px;
	border: dashed 1px var(--MI_THEME-renote);
	border-radius: 8px;
	overflow: clip;
}

.channel {
	opacity: 0.7;
	font-size: 80%;
}

@container (max-width: 450px) {
	.noteHeaderAvatar {
		width: 50px;
		height: 50px;
	}
}
</style>
