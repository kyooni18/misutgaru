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
		[$style.buttonDisabled]: props.disabled
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

	position: relative;
	display: inline-flex;
	flex-shrink: 0;
	margin: 0;
	box-sizing: border-box;
	width: calc(var(--height) * 1.6);
	height: calc(var(--height) + 2px);
	outline: none;
	background: var(--MI_THEME-switchOffBg);
	background-clip: content-box;
	border: solid 1px var(--MI_THEME-switchOffBg);
	border-radius: 999px;
	corner-shape: round;
	box-shadow: 0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent);
	cursor: pointer;
	transition: background-color var(--MI-motion-duration-control) var(--MI-motion-ease-standard), border-color var(--MI-motion-duration-control) var(--MI-motion-ease-standard), box-shadow var(--MI-motion-duration-control) var(--MI-motion-ease-standard), transform var(--MI-motion-duration-feedback) var(--MI-motion-ease-standard);
	user-select: none;

	&:hover:not(.buttonDisabled) {
		box-shadow: 0 2px 3px color-mix(in srgb, var(--MI_THEME-fg) 15%, transparent);
	}

	&:active:not(.buttonDisabled) {
		transform: scale(0.97);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}
}

.buttonChecked {
	background-color: var(--MI_THEME-switchOnBg) !important;
	border-color: var(--MI_THEME-switchOnBg) !important;
}

.buttonDisabled {
	cursor: not-allowed;
	opacity: 0.6;
}

.knob {
	position: absolute;
	box-sizing: border-box;
	top: 3px;
	width: calc(var(--height) - 6px);
	height: calc(var(--height) - 6px);
	border-radius: 999px;
	transition: left var(--MI-motion-duration-control) var(--MI-motion-ease-standard), background-color var(--MI-motion-duration-control) var(--MI-motion-ease-standard), transform var(--MI-motion-duration-control) var(--MI-motion-ease-standard);

	&:not(.knobChecked) {
		left: 3px;
		background: var(--MI_THEME-switchOffFg);
	}
}

.knobChecked {
	left: calc(calc(100% - var(--height)) + 3px);
	background: var(--MI_THEME-switchOnFg);
}

html[data-color-scheme='dark'] .button,
html[data-color-scheme='dark'] .button:hover:not(.buttonDisabled) {
	box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
	.button,
	.knob {
		transition: none;
	}
}
</style>
