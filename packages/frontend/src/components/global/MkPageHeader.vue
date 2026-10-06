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
		<div v-if="!thin_ && (narrow || deviceKind === 'smartphone') && props.displayMyAvatar && $i" class="_button" @click="openAccountMenu">
			<MkAvatar :class="$style.avatar" :user="$i"/>
		</div>
		<div v-else-if="!thin_ && narrow && !hideTitle && !mobileNav" :class="$style.buttons"></div>

		<template v-if="compactTimelineBar">
			<button v-if="!tabsExpanded" class="_button" :class="$style.tabChip" @click="tabsExpanded = true">
				<i v-if="currentTab?.icon" :class="currentTab.icon"></i>
				<span class="_nowrap">{{ currentTab?.title }}</span>
				<i class="ti ti-chevron-down" :class="$style.chevron"></i>
			</button>
			<XTabs v-else :class="[$style.tabs, $style.tabsExpanded]" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
			<div :class="$style.buttons">
				<template v-if="!tabsExpanded">
					<button v-for="action in actions" :key="action.icon" v-tooltip.noDelay="action.text" class="_button" :class="[$style.button, { [$style.highlighted]: action.highlighted }]" @click.stop="action.handler" @touchstart="preventDrag"><i :class="action.icon"></i></button>
					<button class="_button" :class="$style.button" :aria-label="i18n.ts.notifications" @click="mainRouter.push('/my/notifications')">
						<i class="ti ti-bell"></i>
						<span v-if="$i?.hasUnreadNotification" :class="$style.indicator" class="_blink">
							<span class="_indicateCounter" :class="$style.indicateValueIcon">{{ $i.unreadNotificationsCount > 99 ? '99+' : $i.unreadNotificationsCount }}</span>
						</span>
					</button>
					<button class="_button" :class="$style.button" :aria-label="i18n.ts.widgets" @click="shell?.openWidgets()"><i class="ti ti-apps"></i></button>
				</template>
				<button v-else class="_button" :class="$style.button" @click="tabsExpanded = false"><i class="ti ti-chevron-up"></i></button>
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
import { onMounted, onUnmounted, ref, inject, useTemplateRef, computed, watch } from 'vue';
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
const tabsExpanded = ref(false);
const currentTab = computed(() => props.tabs.find(t => t.key === props.tab) ?? props.tabs[0]);
watch(() => props.tab, () => { tabsExpanded.value = false; });
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

.button {
	display: flex;
	align-items: center;
	justify-content: center;
	height: var(--height);
	width: calc(var(--height) - 8px);
	box-sizing: border-box;
	position: relative;
	border-radius: 999px;

	&:hover {
		background: rgba(0, 0, 0, 0.05);
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

.tabChip {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	height: 32px;
	margin-right: auto;
	padding: 0 12px;
	border-radius: 999px;
	font-weight: 600;
	background: var(--MI_THEME-panelHighlight);
	transition: background-color var(--MI-durFast) var(--MI-easeOut);

	&:active {
		background: var(--MI_THEME-accentedBg);
	}
}

.chevron {
	font-size: 0.85em;
	opacity: 0.6;
}

.tabsExpanded {
	flex: 1;
	min-width: 0;
	margin: 0 !important;
	padding: 0 !important;
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
