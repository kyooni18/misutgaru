<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="show" ref="el" :class="[$style.root]">
	<div :class="[$style.upper, { [$style.slim]: narrow, [$style.thin]: thin_ }]">
		<button v-if="mobileNav" class="_button" :class="$style.button" :aria-label="i18n.ts.menu" @click="shell?.openDrawer()">
			<i class="ti ti-menu-2"></i>
			<span v-if="menuIndicated" :class="$style.indicator" class="_blink"><i class="_indicatorCircle"></i></span>
		</button>
		<div v-if="!thin_ && (narrow || deviceKind === 'smartphone') && props.displayMyAvatar && $i" class="_button" :class="$style.fixed" @click="openAccountMenu">
			<MkAvatar :class="$style.avatar" :user="$i"/>
		</div>
		<div v-else-if="!thin_ && narrow && !hideTitle && !mobileNav" :class="$style.buttons"></div>

		<template v-if="compactTimelineBar">
			<div :class="[$style.selectorWrap, { [$style.selectorCollapsed]: mobileSection !== 'timeline' }]">
			<div ref="selectorEl" :class="$style.selector" @scroll.passive="onStripScroll">
				<button
					v-for="t in tabs"
					:key="t.key"
					:ref="el => { if (t.key === tab) activeTabEl = el as HTMLElement | null; }"
					class="_button"
					:class="[$style.selTab, { [$style.selActive]: t.key === tab }]"
					:tabindex="mobileSection === 'timeline' ? 0 : -1"
					@click="ev => onSelectorClick(t, ev)"
				>
					<i v-if="t.icon" :class="t.icon"></i>
					<span :class="$style.selTitle"><span>{{ t.title }}</span></span>
				</button>
			</div>
			</div>
			<button class="_button" :class="[$style.sectionTab, $style.timelineLabel, { [$style.sectionShown]: mobileSection !== 'timeline' }]" :tabindex="mobileSection !== 'timeline' ? 0 : -1" @click="mobileSection = 'timeline'">
				<span :class="$style.selTitle"><span>{{ i18n.ts.timeline }}</span></span>
			</button>
			<div ref="sectionButtonsEl" :class="$style.sectionButtons">
				<template v-if="mobileSection === 'timeline'">
					<button
						v-for="action in actions"
						:key="action.icon"
						v-tooltip.noDelay="action.text"
						class="_button"
						:class="[$style.button, { [$style.highlighted]: action.highlighted }]"
						@click.stop="action.handler"
						@touchstart="preventDrag"
					><i :class="action.icon"></i></button>
				</template>
				<button class="_button" :class="[$style.sectionTab, { [$style.sectionActive]: mobileSection === 'notifications' }]" :aria-label="i18n.ts.notifications" @click="mobileSection = 'notifications'">
					<i class="ti ti-bell"></i>
					<span :class="$style.selTitle"><span>{{ i18n.ts.notifications }}</span></span>
					<span v-if="$i?.hasUnreadNotification && mobileSection !== 'notifications'" :class="$style.indicator" class="_blink">
						<span class="_indicateCounter" :class="$style.indicateValueIcon">{{ $i.unreadNotificationsCount > 99 ? '99+' : $i.unreadNotificationsCount }}</span>
					</span>
				</button>
				<button class="_button" :class="[$style.sectionTab, { [$style.sectionActive]: mobileSection === 'widgets' }]" :aria-label="i18n.ts.widgets" @click="mobileSection = 'widgets'">
					<i class="ti ti-apps"></i>
					<span :class="$style.selTitle"><span>{{ i18n.ts.widgets }}</span></span>
				</button>
			</div>
		</template>

		<template v-else-if="pageMetadata">
			<div v-if="!hideTitle" :class="$style.titleContainer" @click="top">
				<div v-if="pageMetadata.avatar" :class="$style.titleAvatarContainer">
					<MkAvatar :class="$style.titleAvatar" :user="pageMetadata.avatar" indicator/>
				</div>
				<i v-else-if="pageMetadata.icon" :class="[$style.titleIcon, pageMetadata.icon]"></i>

				<div class="_nowrap" :class="$style.title">
					<MkUserName v-if="pageMetadata.userName" :user="pageMetadata.userName" :nowrap="true"/>
					<div v-else-if="pageMetadata.title" class="_nowrap">{{ pageMetadata.title }}</div>
					<div v-if="pageMetadata.subtitle" :class="$style.subtitle">
						{{ pageMetadata.subtitle }}
					</div>
				</div>
			</div>
			<XTabs v-if="!narrow || hideTitle" :class="$style.tabs" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
		</template>
		<div v-if="!compactTimelineBar && ((!thin_ && narrow && !hideTitle) || (actions && actions.length > 0))" :class="$style.buttons">
			<template v-for="action in actions">
				<button v-tooltip.noDelay="action.text" class="_button" :class="[$style.button, { [$style.highlighted]: action.highlighted }]" @click.stop="action.handler" @touchstart="preventDrag"><i :class="action.icon"></i></button>
			</template>
		</div>
	</div>
	<div v-if="(narrow && !hideTitle) && hasTabs" :class="[$style.lower, { [$style.slim]: narrow, [$style.thin]: thin_ }]">
		<XTabs :class="$style.tabs" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
	</div>
</div>
</template>

<script lang="ts">
import type { PageHeaderItem } from '@/types/page-header.js';
import type { PageMetadata } from '@/page.js';
import type { Tab } from './MkPageHeader.tabs.vue';

export type PageHeaderProps = {
	overridePageMetadata?: PageMetadata;
	tabs?: Tab[];
	tab?: string;
	actions?: PageHeaderItem[] | null;
	thin?: boolean;
	hideTitle?: boolean;
	canOmitTitle?: boolean;
	displayMyAvatar?: boolean;
};
</script>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, inject, useTemplateRef, computed, watch, nextTick } from 'vue';
import { mobileSection } from '@/utility/mobile-section.js';
import { i18n } from '@/i18n.js';
import { mainRouter } from '@/router.js';
import { navbarItemDef } from '@/navbar.js';
import { scrollToTop } from '@@/js/scroll.js';
import XTabs from './MkPageHeader.tabs.vue';
import { getAccountMenu } from '@/accounts.js';
import { deviceKind } from '@/utility/device-kind.js';
import { $i } from '@/i.js';
import { DI } from '@/di.js';
import * as os from '@/os.js';

const props = withDefaults(defineProps<PageHeaderProps>(), {
	tabs: () => ([] as Tab[]),
});

const emit = defineEmits<{
	(ev: 'update:tab', key: string): void;
}>();

//const viewId = inject(DI.viewId);
const injectedPageMetadata = inject(DI.pageMetadata, ref(null));
const pageMetadata = computed(() => props.overridePageMetadata ?? injectedPageMetadata.value);

const hideTitle = computed(() => inject('shouldOmitHeaderTitle', false) || props.hideTitle || (props.canOmitTitle && props.tabs.length > 0));
const thin_ = props.thin || inject('shouldHeaderThin', false);

const el = useTemplateRef('el');
const narrow = ref(false);
const hasTabs = computed(() => props.tabs.length > 0);
const shell = inject(DI.mobileShell, null);
// Phone shell: the bottom bar is gone, so nav / notifications / widgets live up here.
const mobileNav = computed(() => shell != null && shell.isMobile.value && narrow.value && !thin_ && $i != null);
const compactTimelineBar = computed(() => mobileNav.value && props.displayMyAvatar && hasTabs.value);
const activeTabEl = ref<HTMLElement | null>(null);
const selectorEl = useTemplateRef('selectorEl');

const sectionButtonsEl = useTemplateRef('sectionButtonsEl');

// Strip and "timeline" label crossfade (opacity only); the buttons that shift as a result
// glide with a transform so no width is animated.
watch(mobileSection, async () => {
	const el = sectionButtonsEl.value;
	if (!el) return;
	const first = el.getBoundingClientRect().left;
	await nextTick();
	const delta = first - el.getBoundingClientRect().left;
	if (Math.abs(delta) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	el.animate([{ transform: `translateX(${delta}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}, { flush: 'pre' });

// Snap picker: the item nearest the centre is the selection. Items shrink, dim and blur with
// distance from the centre; releasing the scroll selects whatever settled there.
const PICKER_RANGE = 96;
let effectFrame = 0;

function applyPickerEffects() {
	effectFrame = 0;
	const strip = selectorEl.value;
	if (!strip) return;
	const sRect = strip.getBoundingClientRect();
	const cx = sRect.left + sRect.width / 2;
	for (const item of Array.from(strip.children) as HTMLElement[]) {
		const r = item.getBoundingClientRect();
		const t = Math.min(1, Math.abs(r.left + r.width / 2 - cx) / PICKER_RANGE);
		item.style.transition = 'none';
		item.style.transform = `scale(${(1 - t * 0.2).toFixed(3)})`;
		item.style.opacity = String((1 - t * 0.65).toFixed(3));
		item.style.filter = t > 0.05 ? `blur(${(t * 2.6).toFixed(2)}px)` : '';
	}
}

function updateFades() {
	if (effectFrame === 0) effectFrame = window.requestAnimationFrame(applyPickerEffects);
}

let settleTimer: number | null = null;

function selectCentered() {
	settleTimer = null;
	const strip = selectorEl.value;
	if (!strip || mobileSection.value !== 'timeline') return;
	const sRect = strip.getBoundingClientRect();
	const cx = sRect.left + sRect.width / 2;
	let best = -1;
	let bestDist = Infinity;
	Array.from(strip.children).forEach((child, i) => {
		const r = child.getBoundingClientRect();
		const d = Math.abs(r.left + r.width / 2 - cx);
		if (d < bestDist) { bestDist = d; best = i; }
	});
	const picked = props.tabs[best];
	if (picked?.key && picked.key !== props.tab) emit('update:tab', picked.key);
}

function onStripScroll() {
	updateFades();
	if (settleTimer != null) window.clearTimeout(settleTimer);
	settleTimer = window.setTimeout(selectCentered, 140);
}

function centerActive() {
	const strip = selectorEl.value;
	const item = activeTabEl.value;
	if (!strip || !item) return;
	const left = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2;
	strip.scrollTo({ left, behavior: 'smooth' });
}

let centerTimer: number | null = null;
function scheduleCenter(delay: number) {
	if (centerTimer != null) window.clearTimeout(centerTimer);
	// wait for the strip's own transition so scrolling does not fight layout
	centerTimer = window.setTimeout(() => { centerTimer = null; centerActive(); updateFades(); }, delay);
}

watch(() => [props.tab, mobileSection.value], () => scheduleCenter(320));
watch(selectorEl, (el) => {
	if (!el) return;
	scheduleCenter(60);
	new ResizeObserver(updateFades).observe(el);
});

function onSelectorClick(t: Tab, ev: MouseEvent) {
	mobileSection.value = 'timeline';
	(ev.currentTarget as HTMLElement | null)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	if (t.onClick) t.onClick(ev as PointerEvent);
	emit('update:tab', t.key);
}
const menuIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (def === 'notifications') continue;
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});
const hasActions = computed(() => props.actions && props.actions.length > 0);
const show = computed(() => {
	return !hideTitle.value || hasTabs.value || hasActions.value;
});

const preventDrag = (ev: TouchEvent) => {
	ev.stopPropagation();
};

const top = () => {
	if (el.value) {
		scrollToTop(el.value as HTMLElement, { behavior: 'smooth' });
	}
};

async function openAccountMenu(ev: PointerEvent) {
	const menuItems = await getAccountMenu({
		withExtraOperation: true,
	});

	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

function onTabClick(): void {
	top();
}

let ro: ResizeObserver | null;

onMounted(() => {
	if (el.value && el.value.parentElement) {
		narrow.value = el.value.parentElement.offsetWidth < 500;
		ro = new ResizeObserver((entries, observer) => {
			if (el.value && el.value.parentElement && window.document.body.contains(el.value as HTMLElement)) {
				narrow.value = el.value.parentElement.offsetWidth < 500;
			}
		});
		ro.observe(el.value.parentElement as HTMLElement);
	}
});

onUnmounted(() => {
	if (ro) ro.disconnect();
});
</script>

<style lang="scss" module>
.root {
	background: var(--MI_THEME-pageHeaderBg);
	border-bottom: solid 1px var(--MI-hairline);
	width: 100%;
	color: var(--MI_THEME-pageHeaderFg);
}

@container style(--MI_THEME-pageHeaderBg: var(--MI_THEME-bg)) {
	.root {
		border-bottom: solid 1px var(--MI-hairline);
	}
}

.upper,
.lower {
	width: 100%;
	background: transparent;
}

.upper {
	contain: layout;
	--height: 50px;
	--margin: var(--MI-margin);
	display: flex;
	gap: var(--margin);
	align-items: center;
	height: var(--height);

	.tabs:first-child,
	&:not(.slim) > :not(.titleContainer) ~ .tabs {
		margin-left: auto;
		padding: 0 12px;
	}

	.tabs {
		margin-right: auto;
	}

	&.thin {
		--height: 40px;
		--margin: 8px;

		> .buttons {
			> .button {
				font-size: 0.9em;
			}
		}
	}

	&.slim {
		text-align: center;

		.titleContainer {
			margin: 0 auto;
			max-width: 100%;
		}
	}
}

.lower {
	--height: 40px;
	height: var(--height);
}

.buttons {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	min-width: var(--height);
	height: var(--height);
	&:empty {
		width: var(--height);
	}
}

.avatar {
	$size: 32px;
	display: inline-block;
	width: $size;
	height: $size;
	vertical-align: bottom;
	margin: 0 8px;
}

.fixed {
	flex-shrink: 0;
}

.button {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	height: var(--height);
	width: calc(var(--height) - 8px);
	box-sizing: border-box;
	position: relative;
	border-radius: 5px;

	@media (hover: hover) {
		&:hover {
			background: rgba(0, 0, 0, 0.05);
		}
	}

	&.highlighted {
		color: var(--MI_THEME-accent);
	}
}

.fullButton {
	& + .fullButton {
		margin-left: 12px;
	}
}

.titleContainer {
	display: flex;
	align-items: center;
	min-width: 0;
	max-width: min(30vw, 400px);
	overflow: clip;
	white-space: nowrap;
	text-align: left;
	font-weight: bold;
	flex-shrink: 1;
	margin-left: 24px;
}

.titleAvatarContainer {
	$size: 32px;
	contain: strict;
	overflow: clip;
	width: $size;
	height: $size;
	padding: 8px;
	flex-shrink: 0;
}

.titleAvatar {
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.titleIcon {
	margin-right: 8px;
	width: 16px;
	text-align: center;
}

.indicator {
	position: absolute;
	top: 6px;
	right: 6px;
	color: var(--MI_THEME-indicator);
	font-size: 8px;
	pointer-events: none;

	&:has(.indicateValueIcon) {
		animation: none;
		top: 2px;
		right: 0;
		font-size: 10px;
	}
}

// timeline strip: icons, the current one labelled; folds away when another section is open
.selectorWrap {
	position: relative;
	flex: 1 1 0;
	min-width: 0;
	max-width: 100%;

	&.selectorCollapsed {
		flex-grow: 0;
		max-width: 0;
		overflow: hidden;
		pointer-events: none;
		// collapse the box only once it has faded out
		transition: max-width 0s 0.16s;

		> .selector {
			opacity: 0;
			transition: opacity 0.16s var(--MI-easeOut);
		}
	}

}

.selector {
	display: flex;
	align-items: center;
	gap: 2px;
	overflow-x: auto;
	scrollbar-width: none;
	scroll-snap-type: x mandatory;
	overscroll-behavior-x: contain;
	-webkit-mask-image: linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);
	mask-image: linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);

	// spacers let the first and last item reach the centre
	&::before,
	&::after {
		content: "";
		flex: 0 0 calc(50% - 22px);
	}
	transition: opacity 0.2s var(--MI-easeOut) 0.06s;
}

.selTab,
.sectionTab {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	height: var(--height, 50px);
	padding: 0 10px;
	white-space: nowrap;
	position: relative;
	opacity: 0.65;
	scroll-snap-align: center;
	transition: opacity 0.25s var(--MI-easeOut);

	// original tab underline, in the text colour rather than the accent
	&::after {
		content: "";
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 0;
		height: 3px;
		border-radius: 999px;
		background: currentColor;
		transform: scaleX(0);
		transition: transform 0.3s var(--MI-easeOut);
		pointer-events: none;
	}

	&:hover {
		opacity: 1;
	}
}

.selTab.selActive,
.sectionTab.sectionActive {
	opacity: 1;

	&::after {
		transform: scaleX(1);
	}
}

// labels: only the active item shows its name, others stay icon-only
.selTitle {
	display: grid;
	grid-template-columns: 0fr;
	opacity: 0;
	transition: grid-template-columns 0.3s var(--MI-easeOut), opacity 0.3s var(--MI-easeOut), margin 0.3s var(--MI-easeOut);

	> span {
		min-width: 0;
		overflow: hidden;
	}
}

.selActive > .selTitle,
.sectionActive > .selTitle,
.sectionShown > .selTitle {
	grid-template-columns: 1fr;
	opacity: 1;
	margin-left: 6px;
}

.timelineLabel {
	max-width: 0;
	padding-inline: 0;
	overflow: hidden;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.16s var(--MI-easeOut), max-width 0s 0.16s, padding 0s 0.16s;

	&.sectionShown {
		max-width: 140px;
		padding-inline: 12px;
		opacity: 1;
		pointer-events: auto;
		transition: opacity 0.2s var(--MI-easeOut) 0.06s;
	}

	> .selTitle {
		margin-left: 0;
	}
}

.sectionButtons {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 2px;
}

.title {
	min-width: 0;
	line-height: 1.2;
	font-family: var(--MI-fontDisplay);
	font-weight: 600;
	font-size: 1.08em;
	letter-spacing: 0.02em;
}

.subtitle {
	opacity: 0.6;
	font-size: 0.8em;
	font-weight: normal;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;

	&.activeTab {
		text-align: center;

		> .chevron {
			display: inline-block;
			margin-left: 6px;
		}
	}
}
</style>
