<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneTip :hidden="!!store.r.tips.value[props.k]" :warn="warn" :rootClass="$style.root" :warnClass="$style.warn" :onClose="_closeTip" :onMenu="showMenu"><slot></slot></VuneTip>
</template>

<script lang="ts" setup>
import VuneTip from './vune/MkTip.vune';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { TIPS, hideAllTips, closeTip } from '@/tips.js';

const props = withDefaults(defineProps<{
	k: typeof TIPS[number];
	warn?: boolean;
}>(), {
	warn: false,
});

function _closeTip() {
	closeTip(props.k);
}

function showMenu(ev: PointerEvent) {
	os.popupMenu([{
		icon: 'ti ti-bulb-off',
		text: i18n.ts.hideAllTips,
		danger: true,
		action: () => {
			hideAllTips();
			os.success();
		},
	}], ev.currentTarget ?? ev.target);
}
</script>

<style lang="scss" module>
.root {
	padding: 12px 14px;
	font-size: 90%;
	background: var(--MI_THEME-infoBg);
	color: var(--MI_THEME-infoFg);
	border-radius: var(--MI-radius);

	&.warn {
		background: var(--MI_THEME-infoWarnBg);
		color: var(--MI_THEME-infoWarnFg);
	}
}

</style>
