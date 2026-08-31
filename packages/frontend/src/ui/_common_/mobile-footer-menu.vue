<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="$style.root">
	<VuneMobileFooterMaterial/>

	<button :class="$style.item" class="_button" :aria-label="i18n.ts.menu" @click="drawerMenuShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-menu-2"></i><span v-if="menuIndicated" :class="$style.itemIndicator" class="_blink"><i class="_indicatorCircle"></i></span>
		</div>
	</button>

	<button :class="$style.item" class="_button" :aria-label="i18n.ts.timeline" @click="mainRouter.push('/')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-home"></i>
		</div>
	</button>

	<button :class="$style.item" class="_button" :aria-label="i18n.ts.notifications" @click="mainRouter.push('/my/notifications')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-bell"></i>
			<span v-if="$i?.hasUnreadNotification" :class="$style.itemIndicator" class="_blink">
				<span class="_indicateCounter" :class="$style.itemIndicateValueIcon">{{ $i.unreadNotificationsCount > 99 ? '99+' : $i.unreadNotificationsCount }}</span>
			</span>
		</div>
	</button>

	<button :class="$style.item" class="_button" :aria-label="i18n.ts.widgets" @click="widgetsShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-apps"></i>
		</div>
	</button>

	<button :class="[$style.item, $style.post]" class="_button" :aria-label="i18n.ts.note" @click="os.post()">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-pencil"></i>
		</div>
	</button>
</div>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef, watch } from 'vue';
import VuneMobileFooterMaterial from './vune/mobile-footer-material.vune?vue-host';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { mainRouter } from '@/router.js';
import { navbarItemDef } from '@/navbar.js';

const drawerMenuShowing = defineModel<boolean>('drawerMenuShowing');
const widgetsShowing = defineModel<boolean>('widgetsShowing');

const rootEl = useTemplateRef('rootEl');

const menuIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (def === 'notifications') continue; // 通知は下にボタンとして表示されてるから
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

watch(rootEl, () => {
	if (rootEl.value) {
		window.document.body.style.setProperty('--MI-minBottomSpacing', 'var(--MI-minBottomSpacingMobile)');
	} else {
		window.document.body.style.setProperty('--MI-minBottomSpacing', '0px');
	}
}, {
	immediate: true,
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	left: 50%;
	right: auto;
	bottom: max(var(--MI-margin), env(safe-area-inset-bottom, 0px));
	z-index: 100;
	display: grid;
	grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
	width: min(340px, calc(100% - (var(--MI-margin) * 2)));
	margin: 0;
	padding: 4px 6px;
	box-sizing: border-box;
	transform: translateX(-50%);
	color: var(--MI_THEME-navFg);
}

.item {
	position: relative;
	z-index: 1;
	min-width: 0;
	padding: 8px 0;

	&.post {
		.itemInner {
			background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
			color: var(--MI_THEME-fgOnAccent);

			&:hover {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}

			&:active {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}
		}
	}
}

.itemInner {
	position: relative;
	padding: 0;
	aspect-ratio: 1;
	width: 100%;
	max-width: 42px;
	margin: auto;
	align-content: center;
	border-radius: 100%;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
	}

	&:active {
		background: var(--MI_THEME-panelHighlight);
	}
}

.itemIcon {
	font-size: 15px;
}

.itemIndicator {
	position: absolute;
	bottom: -4px;
	left: 0;
	right: 0;
	color: var(--MI_THEME-indicator);
	font-size: 10px;
	pointer-events: none;

	&:has(.itemIndicateValueIcon) {
		animation: none;
		font-size: 8px;
	}
}
</style>
