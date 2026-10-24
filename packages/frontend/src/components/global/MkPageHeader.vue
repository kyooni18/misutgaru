<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="show" ref="el" :class="[$style.root]">
	<MunView :render="renderHeader"/>
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
import { onMounted, onUnmounted, ref, shallowRef, inject, useTemplateRef, computed, watch, nextTick, useCssModule, Transition } from 'vue';
import { MunView } from '@mun/vue';
import { pageHeaderView } from './MkPageHeader.mun';
import { mobileSection } from '@/utility/mobile-section.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { navbarItemDef } from '@/navbar.js';
import { scrollToTop } from '@@/js/scroll.js';
import XTabs from './MkPageHeader.tabs.vue';
import { getAccountMenu } from '@/accounts.js';
import { deviceKind } from '@/utility/device-kind.js';
import { $i } from '@/i.js';
import { DI } from '@/di.js';
import * as os from '@/os.js';
import MkAvatar from './MkAvatar.vue';
import MkUserName from './MkUserName.vue';
import { MunDirectives } from '@/utility/mun-directives.js';
import { tooltipDirective as vTooltip } from '@/directives/tooltip.js';

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
const mobileNav = computed(() => shell != null && shell.isMobile.value && !thin_ && $i != null);
const compactTimelineBar = computed(() => mobileNav.value && props.displayMyAvatar && hasTabs.value);
const sourceStrip = shallowRef<HTMLElement | null>(null);

function selectSource(source: Tab, ev: PointerEvent) {
	if (source.onClick) source.onClick(ev);
	if (source.key) emit('update:tab', source.key);
}

// Scroll only the strip, never the document or feed. Swiping does not select a source.
async function revealSource() {
	await nextTick();
	const strip = sourceStrip.value;
	const selected = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
	if (!strip || !selected) return;
	const viewport = strip.getBoundingClientRect();
	const item = selected.getBoundingClientRect();
	const delta = item.left < viewport.left ? item.left - viewport.left : item.right > viewport.right ? item.right - viewport.right : 0;
	strip.scrollBy({ left: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || !prefer.s.animation ? 'instant' : 'smooth' });
}

watch([() => props.tab, sourceStrip], revealSource, { flush: 'post' });

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

const $style = useCssModule();
const components = { MkAvatar, MkUserName, XTabs, Transition, MunDirectives };
const tooltipModifiers = { noDelay: true };

function renderHeader() {
	const narrowTitle = !thin_ && narrow.value && !hideTitle.value;
	const showMyAvatar = !mobileNav.value && !thin_ && (narrow.value || deviceKind === 'smartphone') && props.displayMyAvatar && $i != null;
	return pageHeaderView({
		c: $style,
		components,
		tooltip: (value: string) => [[vTooltip, value, undefined, tooltipModifiers]],
		text: {
			timeline: i18n.ts.timeline,
			menu: i18n.ts.menu,
			notifications: i18n.ts.notifications,
			widgets: i18n.ts.widgets,
		},
		me: $i,
		pageMetadata: pageMetadata.value,
		tabs: props.tabs,
		tab: props.tab,
		actions: props.actions,
		rootEl: el.value,
		thin: thin_,
		narrow: narrow.value,
		hideTitle: hideTitle.value,
		mobileNav: mobileNav.value,
		compact: compactTimelineBar.value,
		section: mobileSection.value,
		menuIndicated: menuIndicated.value,
		showMyAvatar,
		titleSpacer: !showMyAvatar && narrowTitle && !mobileNav.value,
		narrowTitle,
		sourceStripRef: (strip: Element | null) => { sourceStrip.value = strip as HTMLElement | null; },
		setSection: (section: typeof mobileSection.value) => { mobileSection.value = section; },
		openDrawer: () => shell?.openDrawer(),
		openAccountMenu,
		selectSource,
		revealSource,
		updateTab: (key: string) => emit('update:tab', key),
		top: onTabClick,
		preventDrag,
	});
}

let ro: ResizeObserver | null;

onMounted(() => {
	if (el.value && el.value.parentElement) {
		narrow.value = el.value.parentElement.offsetWidth < 500;
		ro = new ResizeObserver((entries, observer) => {
			if (el.value && el.value.parentElement && window.document.body.contains(el.value as HTMLElement)) {
				narrow.value = el.value.parentElement.offsetWidth < 500;
				void revealSource();
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
	container-type: inline-size;
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
	height: calc(var(--height) - 8px);
	width: calc(var(--height) - 8px);
	box-sizing: border-box;
	position: relative;
	border-radius: 999px;
	transition: background var(--MI-durFast) var(--MI-easeOut), transform var(--MI-durFast) var(--MI-easeOut);

	@media (hover: hover) {
		&:hover {
			background: var(--MI-hairline);
		}
	}

	&:active {
		transform: scale(0.97);
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

.mobileToolbar {
	// Grow with text size and available space without introducing a second row.
	--height: clamp(52px, calc(3rem + 1cqi), 64px);
	--margin: clamp(2px, 0.6cqi, 4px);
	box-sizing: border-box;
	padding-inline: clamp(6px, 1.8cqi, 12px);
	gap: 2px;

	.button {
		width: max(44px, 2.75rem);
		height: max(44px, 2.75rem);
		border-radius: 999px;
		transition: background 160ms var(--MI-easeOut), color 160ms var(--MI-easeOut), transform 120ms var(--MI-easeOut);
	}
}

.headingSlot {
	display: grid;
	flex: 1;
	min-width: 0;
	align-items: center;

	> * {
		grid-area: 1 / 1;
		min-width: 0;
	}
}

.headingEnterActive {
	transition: opacity var(--MI-durFast) var(--MI-easeOut);
}

.headingLeaveActive {
	transition: opacity var(--MI-durFast) var(--MI-easeOut);
	pointer-events: none;
	visibility: hidden;
}

.headingEnterFrom {
	opacity: 0;
}

.headingLeaveTo {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.headingEnterActive,
	.headingLeaveActive,
	.mobileToolbar .button {
		transition: none;
	}

	.headingEnterFrom,
	.headingLeaveTo {
		transform: none;
	}
}

.sectionHeading {
	flex: 1;
	min-width: 0;
	font-size: 1.05em;
	text-align: start;
}

.sourceStrip {
	display: flex;
	min-width: 0;
	overflow-x: auto;
	overscroll-behavior-x: contain;
	scrollbar-width: none;
	&::-webkit-scrollbar { display: none; }
}

.sourceButton {
	position: relative;
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	gap: 0;
	min-width: 44px;
	min-height: max(44px, 2.75rem);
	padding: 0 10px;
	box-sizing: border-box;
	border-radius: 12px;
	white-space: nowrap;
	color: var(--MI_THEME-pageHeaderFg);

	// Flat selection: unselected sources recede, the selected one gets an underline
	// rather than a filled pill.
	opacity: 0.6;
	transition: opacity var(--MI-durFast) var(--MI-easeOut);

	&.sourceSelected {
		opacity: 1;

		&::after {
			content: "";
			position: absolute;
			inset-inline: 12px;
			bottom: 4px;
			height: 2px;
			border-radius: 2px;
			background: var(--MI_THEME-accent);
		}
	}
}

.sourceLabel {
	display: grid;
	grid-template-columns: 0fr;
	opacity: 0;
	transition: grid-template-columns var(--MI-dur) var(--MI-easeOut), opacity var(--MI-durFast) var(--MI-easeOut);

	> span {
		min-width: 0;
		overflow: hidden;
		&::before { content: '\00a0'; }
	}
}
.sourceSelected .sourceLabel {
	grid-template-columns: 1fr;
	opacity: 1;
}

@container (min-width: 460px) {
	.sourceLabel { grid-template-columns: 1fr; opacity: 1; }
}

.toolbarActions {
	display: flex;
	flex: none;
}

.sectionButtons {
	display: flex;
	flex: none;
	gap: 2px;
}

.button.sectionActive {
	&::after {
		content: "";
		position: absolute;
		inset-inline: 18px;
		bottom: 4px;
		height: 2px;
		border-radius: 2px;
		background: currentColor;
	}
}

.unreadDot {
	position: absolute;
	top: 9px;
	inset-inline-end: 9px;
	width: 6px;
	height: 6px;
}

.sourceButton,
.button {
	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: -2px;
	}
}

@media (hover: hover) {
	.sourceButton:hover {
		opacity: 1;
	}
}

.title {
	min-width: 0;
	line-height: 1.2;
	font-family: var(--MI-fontDisplay);
	font-weight: 600;
	font-size: 1.08em;
	letter-spacing: normal;
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
