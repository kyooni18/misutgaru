<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_popup_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_popup_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_popup_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_popup_leaveTo : ''"
	appear @beforeEnter="onBeforeEnter" @enter="onEnter" @leave="onLeave" @afterLeave="emit('closed')"
>
	<div v-show="showing" :class="$style.root" :style="{ zIndex, top: top + 'px', left: left + 'px' }" @mouseover="() => { emit('mouseover'); }" @mouseleave="() => { emit('mouseleave'); }">
		<MunView :render="renderCard"/>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { MunView } from '@mun/vue';
import * as Misskey from 'misskey-js';
import { userPopupCard } from './MkUserPopupCard.mun';
import MkFollowButton from '@/components/MkFollowButton.vue';
import MkError from '@/components/global/MkError.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import MkA from '@/components/global/MkA.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import MkAcct from '@/components/global/MkAcct.vue';
import Mfm from '@/components/global/MkMfm.js';
import { userPage } from '@@/js/user.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { getUserMenu } from '@/utility/get-user-menu.js';
import number from '@/filters/number.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { isFollowingVisibleForMe, isFollowersVisibleForMe } from '@/utility/isFfVisibleForMe.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';

const props = defineProps<{
	showing: boolean;
	q: string | Misskey.entities.UserDetailed;
	source: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'mouseover'): void;
	(ev: 'mouseleave'): void;
}>();

const components = { MkError, MkLoading, MkA, MkAvatar, MkUserName, MkAcct, Mfm, MkFollowButton };

function renderCard() {
	const u = user.value;
	return userPopupCard({
		user: u,
		error: error.value,
		showing: props.showing,
		blur: prefer.s.animation && blurReady.value,
		components,
		text: {
			followsYou: i18n.ts.followsYou,
			noAccountDescription: i18n.ts.noAccountDescription,
			notes: i18n.ts.notes,
			following: i18n.ts.following,
			followers: i18n.ts.followers,
		},
		userPage,
		number,
		bannerUrl: u?.bannerUrl ? (prefer.s.disableShowingAnimatedImages ? getStaticImageUrl(u.bannerUrl) : u.bannerUrl) : null,
		showFollowsYou: !!(u && $i && $i.id !== u.id && u.isFollowed),
		showFollowing: !!u && isFollowingVisibleForMe(u),
		showFollowers: !!u && isFollowersVisibleForMe(u),
		showFollowButton: !!(u && $i && u.id !== $i.id),
		onRetry: () => fetchUser(),
		onMenu: showMenu,
		onUpdateUser: (v: Misskey.entities.UserDetailed) => { user.value = v; },
	});
}

const zIndex = os.claimZIndex('middle');
const user = ref<Misskey.entities.UserDetailed | null>(null);
const top = ref(0);
const left = ref(0);
const error = ref(false);
// The card mounts already showing; keep the blur at 0 for the first paint so it ramps in.
const blurReady = ref(false);
let blurFrame = 0;

function onBeforeEnter() {
	cancelAnimationFrame(blurFrame);
	blurReady.value = false;
}

function onEnter() {
	// Reopening after display:none needs a painted zero-blur state as well.
	blurFrame = requestAnimationFrame(() => {
		blurFrame = requestAnimationFrame(() => { blurReady.value = true; });
	});
}

async function onLeave(element: Element, done: () => void) {
	cancelAnimationFrame(blurFrame);
	// v-show lets the card receive showing=false before Vue hides it. Wait for
	// the real CSS transitions (including the longer blur spring) to finish.
	await nextTick();
	const targets = [element, ...element.querySelectorAll('.pbe-blur, .pbe-content')];
	await Promise.allSettled(targets.flatMap(target => target.getAnimations().map(animation => animation.finished)));
	done();
}

function showMenu(ev: PointerEvent) {
	if (user.value == null) return;
	const { menu, cleanup } = getUserMenu(user.value);
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(cleanup);
}

async function fetchUser() {
	if (typeof props.q === 'object') {
		user.value = props.q;
		error.value = false;
	} else {
		const query: Misskey.entities.UsersShowRequest = props.q.startsWith('@') ?
			Misskey.acct.parse(props.q.substring(1)) :
			{ userId: props.q };

		// @ts-expect-error payloadの引数側の型が正常に解決されない
		misskeyApi('users/show', query).then(res => {
			if (!props.showing) return;
			user.value = res;
			error.value = false;
		}, () => {
			error.value = true;
		});
	}
}

onMounted(() => {
	fetchUser();

	const rect = props.source.getBoundingClientRect();
	const x = ((rect.left + (props.source.offsetWidth / 2)) - (300 / 2)) + window.scrollX;
	const y = rect.top + props.source.offsetHeight + window.scrollY;

	top.value = y;
	left.value = x;
});

onUnmounted(() => cancelAnimationFrame(blurFrame));
</script>

<style lang="scss" module>
.transition_popup_enterActive {
	transition: transform var(--MI-motion-duration-surface-enter) var(--MI-motion-ease-emphasized) !important;

	:global(.pbe-content) {
		transition: opacity var(--MI-durFast) var(--MI-easeOut);
	}
}
.transition_popup_leaveActive {
	transition: transform var(--MI-motion-duration-feedback) var(--MI-motion-ease-exit) !important;

	:global(.pbe-content) {
		transition: opacity var(--MI-durFast) var(--MI-easeOut);
	}
}
.transition_popup_enterFrom {
	transform: translateY(6px) scale(0.88);

	:global(.pbe-content) {
		opacity: 0;
	}
}
.transition_popup_leaveTo {
	transform: translateY(2px) scale(0.96);

	// Opacity on the ancestor creates a backdrop root: the blur can no longer
	// sample the page. Fade only the content, which is a sibling of the bands.
	:global(.pbe-content) {
		opacity: 0;
	}
}

.root {
	position: absolute;
	width: 300px;
	transform-origin: center top;
}

</style>

<style lang="scss">
.mkup-card {
	position: relative;
	overflow: clip;
	box-shadow: 0 2px 6px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.12);
}

.mkup-banner {
	height: 78px;
	background-color: rgba(0, 0, 0, 0.1);
	background-size: cover;
	background-position: center;
}

.mkup-followed {
	position: absolute;
	top: 12px;
	left: 12px;
	padding: 4px 8px;
	color: #fff;
	background: rgba(0, 0, 0, 0.7);
	font-size: 0.7em;
	border-radius: 6px;
}

.mkup-avatarBack {
	width: 100px;
	position: absolute;
	top: 28px;
	left: 0;
	right: 0;
	margin: 0 auto;
}

.mkup-avatar {
	display: block;
	position: absolute;
	top: 38px;
	left: 0;
	right: 0;
	margin: 0 auto;
	z-index: 2;
	width: 58px;
	height: 58px;
}

.mkup-title {
	position: relative;
	z-index: 3;
	display: block;
	padding: 8px 26px 16px 26px;
	margin-top: 16px;
	text-align: center;
}

.mkup-name {
	display: inline-block;
	font-weight: bold;
	word-break: break-all;
}

.mkup-username {
	display: block;
	font-size: 0.8em;
	opacity: 0.7;
}

.mkup-description {
	padding: 16px 26px;
	font-size: 0.8em;
	text-align: center;
	border-top: solid 1px var(--MI_THEME-divider);
	border-bottom: solid 1px var(--MI_THEME-divider);
}

.mkup-mfm {
	display: -webkit-box;
	-webkit-line-clamp: 5;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.mkup-status {
	padding: 16px 26px 16px 26px;
}

.mkup-statusItem {
	display: inline-block;
	width: 33%;
	text-align: center;
}

.mkup-statusItemLabel {
	font-size: 0.7em;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}

.mkup-menu {
	position: absolute;
	top: 8px;
	right: 44px;
	padding: 6px;
	background: var(--MI_THEME-panel);
	border-radius: 999px;
}

.mkup-follow {
	position: absolute !important;
	top: 8px;
	right: 8px;
}
</style>
