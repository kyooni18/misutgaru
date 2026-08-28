<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow
	:initialWidth="threadWindowDefaults.width"
	:initialHeight="threadWindowDefaults.height"
	:canResize="true"
	:closeButton="true"
	@closed="emit('closed')"
>
	<template #header>
		<i class="ti ti-message-2" style="margin-right: 0.5em;"></i>
		<span>{{ i18n.ts.note }}</span>
	</template>

	<div :class="$style.root">
		<MkNoteDetailed :note="note" :autoLoadThread="true" />
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { threadWindowDefaults } from '@misutgaru/core';
import * as Misskey from 'misskey-js';
import MkWindow from '@/components/MkWindow.vue';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import { i18n } from '@/i18n.js';

defineProps<{
	note: Misskey.entities.Note;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();
</script>

<style lang="scss" module>
.root {
	min-height: 100%;
	background: var(--MI_THEME-bg);
}
</style>
