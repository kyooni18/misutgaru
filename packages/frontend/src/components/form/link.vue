<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFormLink :to="to" :active="active" :external="external" :behavior="behavior" :inline="inline" :classes="$style">
	<template #icon><slot name="icon"></slot></template>
	<slot></slot>
	<template #suffix><slot name="suffix"></slot></template>
</VuneFormLink>
</template>

<script lang="ts" setup>
import VuneFormLink from './vune/link.vune?vue-host';
defineProps<{
	to?: string;
	active?: boolean;
	external?: boolean;
	behavior?: null | 'window' | 'browser';
	inline?: boolean;
}>();
</script>

<style lang="scss" module>
.root {
	display: block;
	width: 100%;

	&.inline {
		display: inline-block;
		width: auto;
	}
}

.main {
	display: flex;
	align-items: center;
	width: 100%;
	box-sizing: border-box;
	padding: 10px 14px;
	background: var(--MI_THEME-folderHeaderBg);
	border-radius: 6px;
	font-size: 0.9em;

	&:hover {
		text-decoration: none;
		background: var(--MI_THEME-folderHeaderHoverBg);
	}

	&.active {
		color: var(--MI_THEME-accent);
		background: var(--MI_THEME-folderHeaderHoverBg);
	}
}

.icon {
	margin-right: 0.75em;
	flex-shrink: 0;
	text-align: center;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);

	&:empty {
		display: none;

		& + .headerText {
			padding-left: 4px;
		}
	}
}

.headerText {
	white-space: nowrap;
	text-overflow: ellipsis;
	text-align: start;
	overflow: hidden;
	padding-right: 12px;
}

.suffix {
	margin-left: auto;
	opacity: 0.7;
	white-space: nowrap;

	> .suffixText:not(:empty) {
		margin-right: 0.75em;
	}
}
</style>
