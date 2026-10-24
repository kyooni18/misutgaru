<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.iconOnly]: iconOnly }]">
	<MunView :render="renderNavbar"/>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, useCssModule, watch } from 'vue';
import { MunView } from '@mun/vue';
import { navbarView } from './navbar.mun';
import { openInstanceMenu } from './common.js';
import MkProgressiveBlur from '@/components/MkProgressiveBlur.vue';
import MkA from '@/components/global/MkA.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkAcct from '@/components/global/MkAcct.vue';
import { MunDirectives } from '@/utility/mun-directives.js';
import { tooltipDirective as vTooltip } from '@/directives/tooltip.js';
import * as os from '@/os.js';
import { navbarItemDef } from '@/navbar.js';
import { store } from '@/store.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { getHTMLElementOrNull } from '@/utility/get-dom-node-or-null.js';
import { useRouter } from '@/router.js';
import { prefer } from '@/preferences.js';
import { getAccountMenu } from '@/accounts.js';
import { $i } from '@/i.js';

const router = useRouter();

const props = defineProps<{
	showWidgetButton?: boolean;
	asDrawer?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'widgetButtonClick'): void;
}>();

const forceIconOnly = ref(!props.asDrawer && window.innerWidth <= 1279);
const iconOnly = computed(() => {
	return !props.asDrawer && (forceIconOnly.value || (store.r.menuDisplay.value === 'sideIcon'));
});

const otherMenuItemIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (prefer.r.menu.value.includes(def)) continue;
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

// A single pill slides between items instead of each item lighting up on its own.
const middleEl = shallowRef<HTMLElement | null>(null);
const pill = reactive({ top: 0, height: 0, shown: false, animated: false });

function updatePill() {
	const container = middleEl.value;
	const active = container?.querySelector<HTMLElement>(`.${CSS.escape(activeClass)}`);
	if (container == null || active == null) {
		pill.shown = false;
		return;
	}
	pill.top = active.offsetTop;
	pill.height = active.offsetHeight;
	// Only glide once the pill is already on screen, so the first placement doesn't sweep in from the top.
	if (pill.shown) pill.animated = true;
	pill.shown = true;
}

const $style = useCssModule();
const activeClass = $style.active;
const pillObserver = new ResizeObserver(() => updatePill());

onMounted(() => {
	if (middleEl.value) pillObserver.observe(middleEl.value);
	updatePill();
});

onUnmounted(() => {
	pillObserver.disconnect();
});

router.useListener('change', () => nextTick(updatePill));
watch([iconOnly, prefer.r.menu], () => nextTick(updatePill));

function calcViewState() {
	forceIconOnly.value = window.innerWidth <= 1279;
}

window.addEventListener('resize', calcViewState);

watch(store.r.menuDisplay, () => {
	calcViewState();
});

function toggleIconOnly() {
	if (window.document.startViewTransition && prefer.s.animation) {
		window.document.startViewTransition(() => {
			store.set('menuDisplay', iconOnly.value ? 'sideFull' : 'sideIcon');
		});
	} else {
		store.set('menuDisplay', iconOnly.value ? 'sideFull' : 'sideIcon');
	}
}

function toggleRealtimeMode(ev: PointerEvent) {
	os.popupMenu([{
		type: 'label',
		text: i18n.ts.realtimeMode,
	}, {
		text: store.s.realtimeMode ? i18n.ts.turnItOff : i18n.ts.turnItOn,
		icon: store.s.realtimeMode ? 'ti ti-bolt-off' : 'ti ti-bolt',
		action: () => {
			store.set('realtimeMode', !store.s.realtimeMode);
			window.location.reload();
		},
	}], ev.currentTarget ?? ev.target);
}

async function openAccountMenu(ev: PointerEvent) {
	const menuItems = await getAccountMenu({
		withExtraOperation: true,
	});

	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

async function more(ev: PointerEvent) {
	const target = getHTMLElementOrNull(ev.currentTarget ?? ev.target);
	if (!target) return;
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkLaunchPad.vue').then(x => x.default), {
		anchorElement: target,
	}, {
		closed: () => dispose(),
	});
}

function menuEdit() {
	router.push('/settings/navbar');
}

const components = { MkProgressiveBlur, MkA, MkAvatar, MkAcct, MunDirectives };
const tooltipModifiers = { noDelay: true, right: true };

function renderNavbar() {
	return navbarView({
		c: $style,
		components,
		tooltip: (value: string) => [[vTooltip, value, undefined, tooltipModifiers]],
		text: {
			instanceName: instance.name ?? i18n.ts.instance,
			realtimeMode: i18n.ts.realtimeMode,
			widgets: i18n.ts.widgets,
			timeline: i18n.ts.timeline,
			controlPanel: i18n.ts.controlPanel,
			more: i18n.ts.more,
			settings: i18n.ts.settings,
			note: i18n.ts.note,
			account: $i != null ? `${i18n.ts.account}: @${$i.username}` : '',
		},
		me: $i,
		iconOnly: iconOnly.value,
		asDrawer: props.asDrawer,
		showWidgetButton: props.showWidgetButton,
		showSubButtons: !forceIconOnly.value && prefer.r.showNavbarSubButtons.value,
		realtimeMode: store.r.realtimeMode.value,
		instanceIconUrl: instance.iconUrl || '/favicon.ico',
		menu: prefer.r.menu.value,
		navbarItemDef,
		otherMenuItemIndicated: otherMenuItemIndicated.value,
		pill: { ...pill },
		middleRef: (el: Element | null) => { middleEl.value = el as HTMLElement | null; },
		openInstanceMenu,
		toggleRealtimeMode,
		onWidgetButtonClick: () => emit('widgetButtonClick'),
		more,
		post: () => { os.post(); },
		openAccountMenu,
		menuEdit,
		toggleIconOnly,
	});
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	isolation: isolate;
	--nav-width: 250px;
	--nav-icon-only-width: 80px;
	--nav-bg-transparent: color(from var(--MI_THEME-navBg) srgb r g b / 0.5);

	--subButtonWidth: 20px;

	flex: 0 0 var(--nav-width);
	width: var(--nav-width);
	box-sizing: border-box;
}

.body {
	position: relative;
	width: var(--nav-icon-only-width);
	height: 100%;
	box-sizing: border-box;
	overflow: auto;
	overflow-x: clip;
	overscroll-behavior: contain;
	background: var(--MI_THEME-navBg);
	contain: strict;

	/* 画面が縦に長い、設置している項目数が少ないなどの環境においても確実にbottomを最下部に表示するため */
	display: flex;
	flex-direction: column;

	direction: rtl; /* スクロールバーを左に表示したいため */
}

.top {
	flex-shrink: 0;
	direction: ltr;

	/* 疑似progressive blur */
	&::before {
		position: absolute;
		z-index: -1;
		inset: 0;
		content: "";
		backdrop-filter: blur(8px);
		mask-image: linear-gradient(
			to top,
			rgb(0 0 0 / 0%) 0%,
			rgb(0 0 0 / 4.9%) 7.75%,
			rgb(0 0 0 / 10.4%) 11.25%,
			rgb(0 0 0 / 45%) 23.55%,
			rgb(0 0 0 / 55%) 26.45%,
			rgb(0 0 0 / 89.6%) 38.75%,
			rgb(0 0 0 / 95.1%) 42.25%,
			rgb(0 0 0 / 100%) 50%
		);
	}

	&::after {
		position: absolute;
		z-index: -1;
		inset: 0;
		bottom: 25%;
		content: "";
		backdrop-filter: blur(16px);
		mask-image: linear-gradient(
			to top,
			rgb(0 0 0 / 0%) 0%,
			rgb(0 0 0 / 4.9%) 15.5%,
			rgb(0 0 0 / 10.4%) 22.5%,
			rgb(0 0 0 / 45%) 47.1%,
			rgb(0 0 0 / 55%) 52.9%,
			rgb(0 0 0 / 89.6%) 77.5%,
			rgb(0 0 0 / 95.1%) 91.9%,
			rgb(0 0 0 / 100%) 100%
		);
	}
}

.middle {
	position: relative;
	flex: 1;
	direction: ltr;
}

.activePill {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	margin: 0 auto;
	border-radius: 999px;
	background: color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent);
	opacity: 0;
	pointer-events: none;
	transition: opacity var(--MI-dur) var(--MI-easeOut);

	&.activePillShown {
		opacity: 1;
	}

	&.activePillAnimated {
		transition:
			opacity var(--MI-dur) var(--MI-easeOut),
			transform var(--MI-dur) var(--MI-easeOut),
			height var(--MI-dur) var(--MI-easeOut);
	}

	@media (prefers-reduced-motion: reduce) {
		&.activePillAnimated {
			transition: opacity var(--MI-dur) var(--MI-easeOut);
		}
	}
}

.bottom {
	flex-shrink: 0;
	direction: ltr;

	/* 疑似progressive blur */
	&::before {
		position: absolute;
		z-index: -1;
		inset: -30px 0 0 0;
		content: "";
		backdrop-filter: blur(8px);
		mask-image: linear-gradient(
			to bottom,
			rgb(0 0 0 / 0%) 0%,
			rgb(0 0 0 / 4.9%) 7.75%,
			rgb(0 0 0 / 10.4%) 11.25%,
			rgb(0 0 0 / 45%) 23.55%,
			rgb(0 0 0 / 55%) 26.45%,
			rgb(0 0 0 / 89.6%) 38.75%,
			rgb(0 0 0 / 95.1%) 42.25%,
			rgb(0 0 0 / 100%) 50%
		);
		pointer-events: none;
	}

	&::after {
		position: absolute;
		z-index: -1;
		inset: 0;
		top: 25%;
		content: "";
		backdrop-filter: blur(16px);
		mask-image: linear-gradient(
			to bottom,
			rgb(0 0 0 / 0%) 0%,
			rgb(0 0 0 / 4.9%) 15.5%,
			rgb(0 0 0 / 10.4%) 22.5%,
			rgb(0 0 0 / 45%) 47.1%,
			rgb(0 0 0 / 55%) 52.9%,
			rgb(0 0 0 / 89.6%) 77.5%,
			rgb(0 0 0 / 95.1%) 91.9%,
			rgb(0 0 0 / 100%) 100%
		);
	}
}

.subButtons {
	position: fixed;
	left: var(--nav-width);
	bottom: 80px;
	z-index: 1001;
	box-sizing: border-box;
}

.subButton {
	display: block;
	position: relative;
	z-index: 1002;
	width: var(--subButtonWidth);
	height: 50px;
	box-sizing: border-box;
	align-content: center;
}

.subButtonShape {
	position: absolute;
	z-index: -1;
	top: 0;
	bottom: 0;
	left: 0;
	margin: auto;
	width: var(--subButtonWidth);
	height: calc(var(--subButtonWidth) * 4);
}

.subButtonClickable {
	position: absolute;
	display: block;
	max-width: unset;
	width: 24px;
	height: 42px;
	top: 0;
	bottom: 0;
	left: -4px;
	margin: auto;
	font-size: 10px;

	&:hover {
		color: var(--MI_THEME-fgHighlighted);

		.subButtonIcon {
			opacity: 1;
		}
	}
}

.subButtonIcon {
	margin-left: -4px;
	opacity: 0.7;
}

.subButtonGapFill {
	position: relative;
	z-index: 1001;
	width: var(--subButtonWidth);
	height: 64px;
	margin-top: -32px;
	margin-bottom: -32px;
	pointer-events: none;
	background: var(--MI_THEME-navBg);
}

.subButtonGapFillDivider {
	position: relative;
	z-index: 1010;
	margin-left: -2px;
	width: 14px;
	height: 1px;
	background: var(--MI_THEME-divider);
	pointer-events: none;
}

// The indicator is one Mün Text; its dot/badge sits in ::before as an inline
// box on the text baseline, exactly where the former nested element was.
.itemIndicatorDot::before {
	content: "";
	display: inline-block;
	width: 1em;
	height: 1em;
	border-radius: 100%;
	background: currentColor;
}

.itemIndicatorCounter::before {
	content: attr(data-value);
	display: inline-flex;
	color: var(--MI_THEME-fgOnAccent);
	font-weight: 700;
	background: var(--MI_THEME-indicator);
	height: 1.5em;
	min-width: 1.5em;
	align-items: center;
	justify-content: center;
	border-radius: 99rem;
	padding: 0.3em 0.5em;
}

.root:not(.iconOnly) {
	.body {
		width: var(--nav-width);
	}

	.top {
		--top-height: 80px;

		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		height: var(--top-height);
		padding-left: 6px;
	}

	.instance {
		position: relative;
		width: var(--top-height);
	}

	.instanceIcon {
		display: inline-block;
		width: 38px;
		aspect-ratio: 1;
		border-radius: 8px;
	}

	.realtimeMode {
		display: inline-block;
		width: var(--top-height);
		margin-left: auto;

		&.on {
			color: var(--MI_THEME-accent);
		}
	}

	.widget {
		display: inline-block;
		width: var(--top-height);
		margin-left: auto;
	}

	.bottom {
		position: sticky;
		bottom: 0;
		padding-top: 20px;
	}

	.post {
		position: relative;
		display: block;
		width: 100%;
		height: 40px;
		color: var(--MI_THEME-fgOnAccent);
		font-weight: bold;
		text-align: left;

		&::before {
			content: "";
			display: block;
			width: calc(100% - 38px);
			height: 100%;
			margin: auto;
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			border-radius: 999px;
			background: var(--MI_THEME-accent);
			transition: filter var(--MI-dur) var(--MI-easeOut), box-shadow var(--MI-dur) var(--MI-easeOut);
		}

		&:focus-visible {
			outline: none;

			&::before {
				outline: 2px solid var(--MI_THEME-fgOnAccent);
				outline-offset: -4px;
			}
		}

		&:hover, &.active {
			&::before {
				filter: brightness(1.08);
			}
		}
	}

	.postIcon {
		position: relative;
		margin-left: 30px;
		margin-right: 8px;
		width: 32px;
	}

	.postText {
		position: relative;
	}

	.account {
		position: relative;
		display: flex;
		align-items: center;
		padding: 20px 0 20px 30px;
		width: 100%;
		text-align: left;
		box-sizing: border-box;
		overflow: clip;

		&:focus-visible {
			outline: none;

			> .avatar {
				box-shadow: 0 0 0 4px var(--MI_THEME-focus);
			}
		}
	}

	.avatar {
		display: block;
		flex-shrink: 0;
		position: relative;
		width: 32px;
		aspect-ratio: 1;
		margin-right: 8px;
	}

	.acct {
		display: block;
		flex-shrink: 1;
		padding-right: 8px;
	}

	.divider {
		margin: 12px 24px;
		// Divider() is an <hr>: drop the global hr bar so only the top border shows.
		height: 0;
		border: none;
		background: none;
		border-top: solid 1px var(--MI-hairline);
	}

	.item {
		position: relative;
		display: block;
		padding-left: 30px;
		line-height: 2.85rem;
		font-weight: 500;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		width: 100%;
		text-align: left;
		box-sizing: border-box;
		color: var(--MI_THEME-navFg);

		&:hover {
			text-decoration: none;
			color: light-dark(hsl(from var(--MI_THEME-navFg) h s calc(l - 17)), hsl(from var(--MI_THEME-navFg) h s calc(l + 17)));
		}

		&.active {
			color: var(--MI_THEME-navActive);
		}

		&:focus-visible {
			outline: none;

			&::before {
				outline: 2px solid var(--MI_THEME-focus);
				outline-offset: -2px;
			}
		}

		&::before {
			content: "";
			display: block;
			width: calc(100% - 24px);
			height: 100%;
			margin: auto;
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			border-radius: 12px;
			background: color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent);
			opacity: 0;
			transform: scale(0.96);
			transition: opacity var(--MI-durFast) var(--MI-easeOut), transform var(--MI-dur) var(--MI-easeOut);
		}

		&:hover, &.active, &:focus-visible {
			color: var(--MI_THEME-fgHighlighted);
		}

		&:hover:not(.active), &:focus-visible {
			&::before {
				opacity: 1;
				transform: none;
			}
		}

		&:active > .itemIcon {
			transform: scale(0.88);
		}
	}

	.activePill {
		width: calc(100% - 24px);
		border-radius: 12px;
	}

	.itemIcon {
		position: relative;
		width: 32px;
		margin-right: 8px;
		display: inline-block;
		transition: transform var(--MI-durFast) var(--MI-easeOut);
	}

	.itemIndicator {
		position: absolute;
		top: 0;
		left: 20px;
		color: var(--MI_THEME-navIndicator);
		font-size: 8px;

		&.itemIndicatorCounter {
			animation: none;
			left: auto;
			right: 40px;
			font-size: 10px;
		}
	}

	.itemText {
		position: relative;
		font-size: 0.9em;
	}

	.subButtons {
		left: var(--nav-width);
	}
}

.root.iconOnly {
	flex: 0 0 var(--nav-icon-only-width);
	width: var(--nav-icon-only-width);

	.body {
		width: var(--nav-icon-only-width);
	}

	.top {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 20px 0;
	}

	.instance {
		display: block;
		text-align: center;
		width: 100%;

		&:focus-visible {
			outline: none;

			> .instanceIcon {
				outline: 2px solid var(--MI_THEME-focus);
				outline-offset: 2px;
			}
		}
	}

	.instanceIcon {
		display: inline-block;
		width: 30px;
		aspect-ratio: 1;
		border-radius: 8px;
	}

	.bottom {
		position: sticky;
		bottom: 0;
		padding-top: 20px;
	}

	.widget {
		display: block;
		position: relative;
		width: 100%;
		height: 52px;
		text-align: center;
	}

	.realtimeMode {
		display: block;
		position: relative;
		width: 100%;
		height: 52px;
		text-align: center;

		&.on {
			color: var(--MI_THEME-accent);
		}
	}

	.post {
		display: block;
		position: relative;
		width: 100%;
		height: 52px;
		text-align: center;

		&::before {
			content: "";
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			margin: auto;
			width: 52px;
			aspect-ratio: 1/1;
			border-radius: 100%;
			background: var(--MI_THEME-accent);
		}

		&:focus-visible {
			outline: none;

			&::before {
				outline: 2px solid var(--MI_THEME-fgOnAccent);
				outline-offset: -4px;
			}
		}

		&:hover, &.active {
			&::before {
				background: hsl(from var(--MI_THEME-accent) h s calc(l + 10));
			}
		}
	}

	.postIcon {
		position: relative;
		color: var(--MI_THEME-fgOnAccent);
	}

	.postText {
		display: none;
	}

	.account {
		display: block;
		text-align: center;
		padding: 20px 0;
		width: 100%;
		overflow: clip;

		&:focus-visible {
			outline: none;

			> .avatar {
				box-shadow: 0 0 0 4px var(--MI_THEME-focus);
			}
		}
	}

	.avatar {
		display: inline-block;
		width: 38px;
		aspect-ratio: 1;
	}

	.acct {
		display: none;
	}

	.divider {
		margin: 8px auto;
		width: calc(100% - 32px);
		// Divider() is an <hr>: drop the global hr bar so only the top border shows.
		height: 0;
		border: none;
		background: none;
		border-top: solid 0.5px var(--MI_THEME-divider);
	}

	.item {
		display: block;
		position: relative;
		padding: 16px 0;
		width: 100%;
		text-align: center;

		&:focus-visible {
			outline: none;

			&::before {
				outline: 2px solid var(--MI_THEME-focus);
				outline-offset: -2px;
			}
		}

		&::before {
			content: "";
			display: block;
			height: 100%;
			aspect-ratio: 1;
			margin: auto;
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			border-radius: 999px;
			background: color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent);
			opacity: 0;
			transform: scale(0.8);
			transition: opacity var(--MI-durFast) var(--MI-easeOut), transform var(--MI-dur) var(--MI-easeOut);
		}

		&:hover, &.active, &:focus-visible {
			text-decoration: none;
			color: var(--MI_THEME-fgHighlighted);

			> .itemIcon {
				opacity: 1;
			}
		}

		&:hover:not(.active), &:focus-visible {
			&::before {
				opacity: 1;
				transform: none;
			}
		}

		&:active > .itemIcon {
			transform: scale(0.86);
		}
	}

	.activePill {
		width: var(--pillHeight);
	}

	.itemIcon {
		display: block;
		margin: 0 auto;
		opacity: 0.7;
		transition: opacity var(--MI-durFast) var(--MI-easeOut), transform var(--MI-durFast) var(--MI-easeOut);
	}

	.itemText {
		display: none;
	}

	.itemIndicator {
		position: absolute;
		top: 6px;
		left: 24px;
		color: var(--MI_THEME-navIndicator);
		font-size: 8px;

		&.itemIndicatorCounter {
			animation: none;
			top: 4px;
			left: auto;
			right: 4px;
			font-size: 10px;
		}
	}

	.subButtons {
		left: var(--nav-icon-only-width);
	}
}
</style>
