<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPagination :paginator="paginator" :direction="direction" :autoLoad="autoLoad" :pullToRefresh="pullToRefresh" :withControl="withControl" :forceDisableInfiniteScroll="forceDisableInfiniteScroll">
	<template #empty><MkResult type="empty" :text="i18n.ts.noNotes"/></template>

	<template #default>
		<div ref="virtualRoot" :class="[$style.root, { [$style.noGap]: noGap, '_gaps': !noGap }]">
			<div v-if="virtualizationEnabled && beforeSize > 0" aria-hidden="true" :class="$style.virtualSpacer" :style="{ height: `${beforeSize}px` }"></div>
			<div
				v-for="entry in virtualEntries"
				:key="entry.key"
				:ref="el => setVirtualRow(el, entry)"
				:data-virtual-index="entry.index"
				:data-scroll-anchor="entry.item.id"
				:class="$style.virtualRow"
			>
				<template v-if="entry.index > 0 && isSeparatorNeeded(timelineNotes[entry.index - 1].createdAt, entry.item.createdAt)">
					<div :class="{ '_gaps': !noGap }">
						<div :class="[$style.date, { [$style.noGap]: noGap }]">
							<span><i class="ti ti-chevron-up"></i> {{ getSeparatorInfo(timelineNotes[entry.index - 1].createdAt, entry.item.createdAt)?.prevText }}</span>
							<span style="height: 1em; width: 1px; background: var(--MI_THEME-divider);"></span>
							<span>{{ getSeparatorInfo(timelineNotes[entry.index - 1].createdAt, entry.item.createdAt)?.nextText }} <i class="ti ti-chevron-down"></i></span>
						</div>
						<MkNote :class="$style.note" :note="entry.item" :withHardMute="true"/>
						<div v-if="entry.item._shouldInsertAd_" :class="$style.ad">
							<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
						</div>
					</div>
				</template>
				<template v-else-if="entry.item._shouldInsertAd_">
					<div :class="{ '_gaps': !noGap }">
						<MkNote :class="$style.note" :note="entry.item" :withHardMute="true"/>
						<div :class="$style.ad">
							<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
						</div>
					</div>
				</template>
				<MkNote v-else :class="$style.note" :note="entry.item" :withHardMute="true"/>
			</div>
			<div v-if="virtualizationEnabled && afterSize > 0" aria-hidden="true" :class="$style.virtualSpacer" :style="{ height: `${afterSize}px` }"></div>
		</div>
	</template>
</MkPagination>
</template>

<script lang="ts" setup generic="T extends IPaginator<Misskey.entities.Note>">
import { computed, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import * as Misskey from 'misskey-js';
import type { MkPaginationOptions } from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import MkNote from '@/components/MkNote.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { useGlobalEvent } from '@/events.js';
import { isSeparatorNeeded, getSeparatorInfo } from '@/utility/timeline-date-separate.js';
import { clearPreparedNoteCache, prefetchPreparedNotes } from '@/utility/prepared-note.js';
import { useVariableVirtualList } from '@/composables/use-variable-virtual-list.js';
import type { VariableVirtualEntry } from '@/composables/use-variable-virtual-list.js';
import { normalizeNoteEntity, evictNormalizedNote } from '@/utility/normalized-entity-cache.js';
import { prefetchNoteMedia } from '@/utility/media-prefetch.js';

const props = withDefaults(defineProps<MkPaginationOptions & {
	paginator: T;
	noGap?: boolean;
}>(), {
	autoLoad: true,
	direction: 'down',
	pullToRefresh: true,
	withControl: true,
	forceDisableInfiniteScroll: false,
});
const timelineNotes = computed(() => props.paginator.items.value.map(note => normalizeNoteEntity(note)));
const virtualRoot = ref<HTMLElement | null>(null);
const {
	enabled: virtualizationEnabled,
	entries: virtualEntries,
	range: virtualRange,
	beforeSize,
	afterSize,
	observeRow: observeVirtualRow,
} = useVariableVirtualList({
	items: timelineNotes,
	root: virtualRoot,
	keyOf: note => note.id,
	estimate: 220,
	overscan: 5,
	threshold: 72,
});

function setVirtualRow(el: Element | ComponentPublicInstance | null, entry: VariableVirtualEntry<Misskey.entities.Note>): void {
	observeVirtualRow(typeof Element !== 'undefined' && el instanceof Element ? el : null, entry);
}

useGlobalEvent('noteDeleted', (noteId) => {
	props.paginator.removeItem(noteId);
	evictNormalizedNote(noteId);
	clearPreparedNoteCache(noteId);
});

watch(timelineNotes, notes => {
	prefetchPreparedNotes(notes);
}, { immediate: true, deep: false });

const mediaPrefetchItems = computed(() => {
	return timelineNotes.value;
});

watch(mediaPrefetchItems, notes => {
	prefetchNoteMedia(notes);
}, { immediate: true, deep: false });

function reload() {
	return props.paginator.reload();
}

defineExpose({
	reload,
});
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;

	&.noGap {
		background: var(--MI_THEME-panel);

		.note {
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}

		.ad {
			padding: 8px;
			background-size: auto auto;
			background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, var(--MI_THEME-bg) 8px, var(--MI_THEME-bg) 14px);
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}
	}

	&:not(.noGap) {
		background: var(--MI_THEME-bg);

		.note {
			background: var(--MI_THEME-panel);
			border-radius: var(--MI-radius);
		}
	}
}

.virtualRow {
	min-width: 0;
}

.virtualSpacer {
	flex: 0 0 auto;
	width: 100%;
	pointer-events: none;
}

.date {
	display: flex;
	font-size: 85%;
	align-items: center;
	justify-content: center;
	gap: 1em;
	opacity: 0.75;
	padding: 8px 8px;
	margin: 0 auto;

	&.noGap {
		border-bottom: solid 0.5px var(--MI_THEME-divider);
	}
}

.ad:empty {
	display: none;
}
</style>
