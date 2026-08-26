<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span
	v-tooltip="checked ? i18n.ts.itsOn : i18n.ts.itsOff"
	:class="{
		[$style.button]: true,
		[$style.buttonChecked]: checked,
		[$style.buttonDisabled]: props.disabled,
	}"
	data-testid="switch-toggle"
	@click.prevent.stop="toggle"
>
	<div :class="{ [$style.knob]: true, [$style.knobChecked]: checked }"></div>
</span>
</template>

<script lang="ts" setup>
import { toRefs } from 'vue';
import type { Ref } from 'vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	checked: boolean | Ref<boolean>;
	disabled?: boolean | Ref<boolean>;
}>(), {
	disabled: false,
});

const emit = defineEmits<{
	(ev: 'toggle'): void;
}>();

const checked = toRefs(props).checked;
const toggle = () => {
	emit('toggle');
};
</script>

<style lang="scss" module>
.button {
	--height: 21px;
	--inset: 2px;
	--knob-size: calc(var(--height) - 2px);

	position: relative;
	display: inline-flex;
	flex-shrink: 0;
	margin: 0;
	box-sizing: border-box;
	width: calc(var(--height) * 1.8);
	height: calc(var(--height) + 2px);
	outline: none;
	background: var(--MI_THEME-switchOffBg);
	background-clip: content-box;
	border: solid 1px var(--MI_THEME-switchOffBg);
	border-radius: 999px;
	corner-shape: squircle;
	box-shadow:
		inset 0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 10%, transparent),
		0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 9%, transparent);
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
	user-select: none;

	&:hover:not(.buttonDisabled) {
		box-shadow:
			inset 0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent),
			0 2px 4px color-mix(in srgb, var(--MI_THEME-fg) 13%, transparent);
		transform: translateY(-1px);
	}

	&:active:not(.buttonDisabled) {
		box-shadow:
			inset 0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 16%, transparent),
			0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 9%, transparent);
		transform: translateY(0) scale(0.97);
	}
}

.buttonChecked {
	background-color: var(--MI_THEME-switchOnBg) !important;
	border-color: var(--MI_THEME-switchOnBg) !important;
}

.buttonDisabled {
	cursor: not-allowed;
}

.knob {
	position: absolute;
	box-sizing: border-box;
	// `button` has a 1px border, so center the knob in its inner height
	// instead of reusing the horizontal inset. This keeps the vertical
	// padding equal on both sides without changing the switch's width.
	top: calc((var(--height) - var(--knob-size)) / 2);
	width: var(--knob-size);
	height: var(--knob-size);
	border-radius: 999px;
	corner-shape: round;
	box-shadow:
		0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 20%, transparent),
		inset 0 1px 0 color-mix(in srgb, var(--MI_THEME-panel) 55%, transparent);
	transition: left 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;

	&:not(.knobChecked) {
		left: var(--inset);
		background: var(--MI_THEME-switchOffFg);
	}
}

.knobChecked {
	left: calc(100% - var(--knob-size) - var(--inset));
	background: var(--MI_THEME-switchOnFg);
}
</style>
