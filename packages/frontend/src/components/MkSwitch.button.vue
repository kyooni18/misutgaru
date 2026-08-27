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
	--height: 22px;
	--inset: 2px;
	--knob-size: calc(var(--height) - (var(--inset) * 2));

	position: relative;
	display: inline-flex;
	flex-shrink: 0;
	margin: 0;
	box-sizing: border-box;
	width: calc(var(--height) * 1.8);
	height: var(--height);
	outline: none;
	background: var(--MI_THEME-switchOffBg);
	border: 0;
	border-radius: 999px;
	corner-shape: round;
	box-shadow:
		inset 0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 14%, transparent),
		0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent);
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
	user-select: none;

	&:hover:not(.buttonDisabled) {
		box-shadow:
			inset 0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent),
			0 2px 4px color-mix(in srgb, var(--MI_THEME-fg) 16%, transparent);
	}

	&:active:not(.buttonDisabled) {
		box-shadow:
			inset 0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 16%, transparent),
			0 1px 1px color-mix(in srgb, var(--MI_THEME-fg) 9%, transparent);
		transform: scale(0.96);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}
}

.buttonChecked {
	background-color: var(--MI_THEME-accent);
	box-shadow:
		inset 0 1px 1px color-mix(in srgb, var(--MI_THEME-fgOnAccent) 18%, transparent),
		0 1px 2px color-mix(in srgb, var(--MI_THEME-accent) 30%, transparent);
}

.buttonDisabled {
	cursor: not-allowed;
}

.knob {
	position: absolute;
	box-sizing: border-box;
	inset-block-start: var(--inset);
	width: var(--knob-size);
	height: var(--knob-size);
	border-radius: 999px;
	corner-shape: round;
	box-shadow:
		0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 24%, transparent),
		inset 0 1px 0 color-mix(in srgb, var(--MI_THEME-panel) 65%, transparent);
	transition: left 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;

	&:not(.knobChecked) {
		left: var(--inset);
		background: var(--MI_THEME-bg);
	}
}

.knobChecked {
	left: calc(100% - var(--knob-size) - var(--inset));
	background: var(--MI_THEME-bg);
}
</style>
