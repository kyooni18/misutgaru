<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAvatarDecoration :active="props.active" :decoration="props.decoration" :angle="props.angle" :flipH="props.flipH" :offsetX="props.offsetX" :offsetY="props.offsetY" :locked="locked" :user="$i" :rootClass="$style.root" :activeClass="$style.active" :nameClass="$style.name" :lockClass="$style.lock" :onClick="() => emit('click')"/>
</template>

<script lang="ts" setup>
import VuneAvatarDecoration from './vune/avatar-decoration.decoration.vune?vue-host';
import { computed } from 'vue';
import { ensureSignin } from '@/i.js';

const $i = ensureSignin();

const props = defineProps<{
	active?: boolean;
	decoration: {
		id: string;
		url: string;
		name: string;
		roleIdsThatCanBeUsedThisDecoration: string[];
	};
	angle?: number;
	flipH?: boolean;
	offsetX?: number;
	offsetY?: number;
}>();

const emit = defineEmits<{
	(ev: 'click'): void;
}>();

const locked = computed(() => props.decoration.roleIdsThatCanBeUsedThisDecoration.length > 0 && !$i.roles.some(r => props.decoration.roleIdsThatCanBeUsedThisDecoration.includes(r.id)));
</script>

<style lang="scss" module>
.root {
	cursor: pointer;
	padding: 16px 16px 28px 16px;
	border: solid 2px var(--MI_THEME-divider);
	border-radius: 8px;
	text-align: center;
	font-size: 90%;
	overflow: clip;
	contain: content;
}

.active {
	background-color: var(--MI_THEME-accentedBg);
	border-color: var(--MI_THEME-accent);
}

.name {
	position: relative;
	z-index: 10;
	font-weight: bold;
	margin-bottom: 20px;
}

.lock {
	position: absolute;
	bottom: 12px;
	right: 12px;
	color: var(--MI_THEME-warn);
}
</style>
