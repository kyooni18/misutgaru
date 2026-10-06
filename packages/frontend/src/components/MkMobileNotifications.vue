<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div :class="$style.bar">
		<button v-for="t in tabs" :key="t.key" class="_button" :class="[$style.chip, { [$style.active]: tab === t.key }]" @click="tab = t.key">{{ t.title }}</button>
		<span :class="$style.spacer"></span>
		<template v-if="tab === 'all'">
			<button class="_button" :class="[$style.iconButton, { [$style.active]: includeTypes != null }]" :aria-label="i18n.ts.filter" @click="setFilter"><i class="ti ti-filter"></i></button>
			<button class="_button" :class="$style.iconButton" :aria-label="i18n.ts.markAllAsRead" @click="markAllAsRead"><i class="ti ti-check"></i></button>
		</template>
	</div>
	<MkStreamingNotificationsTimeline v-if="tab === 'all'" :key="String(includeTypes)" :excludeTypes="excludeTypes"/>
	<MkNotesTimeline v-else-if="tab === 'mentions'" :paginator="mentionsPaginator"/>
	<MkNotesTimeline v-else :paginator="directNotesPaginator"/>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import { notificationTypes } from 'misskey-js';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const tab = ref<'all' | 'mentions' | 'directNotes'>('all');
const tabs = computed(() => [
	{ key: 'all' as const, title: i18n.ts.all },
	{ key: 'mentions' as const, title: i18n.ts.mentions },
	{ key: 'directNotes' as const, title: i18n.ts.directNotes },
]);

const includeTypes = ref<string[] | null>(null);
const excludeTypes = computed(() => includeTypes.value ? notificationTypes.filter(t => !includeTypes.value!.includes(t)) : null);

const mentionsPaginator = markRaw(new Paginator('notes/mentions', { limit: 10 }));
const directNotesPaginator = markRaw(new Paginator('notes/mentions', { limit: 10, params: { visibility: 'specified' } }));

function setFilter(ev: PointerEvent) {
	const typeItems = notificationTypes.map(t => ({
		text: i18n.ts._notification._types[t],
		active: includeTypes.value?.includes(t) ?? false,
		action: () => { includeTypes.value = [t]; },
	}));
	const items = includeTypes.value != null ? [{
		icon: 'ti ti-x',
		text: i18n.ts.clear,
		action: () => { includeTypes.value = null; },
	}, { type: 'divider' as const }, ...typeItems] : typeItems;
	os.popupMenu(items, (ev.currentTarget ?? ev.target) as HTMLElement);
}

function markAllAsRead() {
	os.apiWithDialog('notifications/mark-all-as-read', {});
}
</script>

<style lang="scss" module>
.bar {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 12px;
}

.spacer {
	flex: 1;
}

.chip,
.iconButton {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 30px;
	padding: 0 12px;
	border-radius: 999px;
	font-size: 0.9em;
	color: color-mix(in srgb, var(--MI_THEME-fg) 70%, transparent);
	transition: background-color 0.2s var(--MI-easeOut), color 0.2s var(--MI-easeOut);

	&.active {
		color: var(--MI_THEME-fg);
		background: var(--MI_THEME-panelHighlight);
	}
}

.iconButton {
	width: 30px;
	padding: 0;
}
</style>
