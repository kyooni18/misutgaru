<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	class="omfetrab misutgaru-material misutgaru-material--regular"
	:class="['s' + size, 'w' + width, 'h' + height, { asDrawer, asWindow }]"
	:style="{ maxHeight: maxHeight ? maxHeight + 'px' : undefined }"
>
	<div class="top">
		<div class="searchShell">
			<i class="ti ti-search searchIcon"></i>
			<input
				ref="searchEl"
				:value="q"
				class="search"
				data-prevent-emoji-insert
				:placeholder="i18n.ts.search"
				type="search"
				autocapitalize="off"
				@input="input()"
				@paste.stop="paste"
				@keydown="onKeydown"
			>
			<button v-if="q" class="_button searchAction" type="button" :aria-label="i18n.ts.clear" @click="q = ''; focus()"><i class="ti ti-x"></i></button>
			<button v-else v-tooltip="i18n.ts.settings" class="_button searchAction" type="button" :aria-label="i18n.ts.settings" @click="settings"><i class="ti ti-settings"></i></button>
		</div>

		<nav v-if="!q" ref="categoryRailEl" class="categoryRail" :aria-label="i18n.ts.emoji">
			<button
				v-for="(category, index) in pickerCategories"
				:key="category.key"
				class="_button categoryButton"
				:class="{ categoryButtonActive: activeCategoryIndex === index }"
				type="button"
				:title="category.label"
				:aria-label="category.label"
				:aria-current="activeCategoryIndex === index ? 'true' : undefined"
				@click="selectCategory(index)"
				@keydown.left.prevent="selectCategory(index - 1)"
				@keydown.right.prevent="selectCategory(index + 1)"
			>
				<i :class="category.icon"></i>
			</button>
		</nav>
	</div>

	<!-- Search temporarily replaces the category carousel, like a native picker. -->
	<div v-if="q" ref="emojisEl" class="searchResults" tabindex="-1">
		<span class="visuallyHidden">{{ i18n.ts.search }}</span>
		<div v-if="searchResults.length > 0" class="emojiGrid">
			<button
				v-for="emoji in searchResults"
				:key="getKey(emoji)"
				class="_button emojiItem"
				:data-emoji="getKey(emoji)"
				:disabled="!canReact(emoji)"
				:title="emojiTitle(emoji)"
				@click="chosen(emoji, $event)"
			>
				<MkCustomEmoji v-if="isCustomEmoji(emoji)" class="emoji" :name="getKey(emoji)" :normal="true" :fallbackToImage="true"/>
				<MkEmoji v-else class="emoji" :emoji="getKey(emoji)" :normal="true"/>
			</button>
		</div>
		<div v-else class="empty">{{ i18n.ts.none }}</div>
	</div>

	<div v-else class="carouselShell">
		<div ref="carouselEl" class="categoryCarousel" @scroll.passive="onCarouselScroll">
			<section
				v-for="(category, index) in pickerCategories"
				:key="category.key"
				:data-picker-category-index="index"
				class="categoryPane"
				:class="{
					categoryPaneActive: activeCategoryIndex === index,
					categoryPaneNeighbor: Math.abs(activeCategoryIndex - index) === 1,
				}"
				:aria-label="category.label"
			>
				<!-- Keep the label in the pane for accessibility and existing UI tests, but visually stay icon-only. -->
				<span class="visuallyHidden">{{ category.label }}</span>
				<div v-if="shouldRenderCategory(index)" class="emojiGrid">
					<button
						v-for="emoji in category.items"
						:key="getKey(emoji)"
						class="_button emojiItem"
						:data-emoji="getKey(emoji)"
						:disabled="!canReact(emoji)"
						:title="emojiTitle(emoji)"
						@click="chosen(emoji, $event)"
					>
						<MkCustomEmoji v-if="isCustomEmoji(emoji)" class="emoji" :name="getKey(emoji)" :normal="true" :fallbackToImage="true"/>
						<MkEmoji v-else class="emoji" :emoji="getKey(emoji)" :normal="true"/>
					</button>
				</div>
			</section>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as Misskey from 'misskey-js';
import {
	emojilist,
	emojiCharByCategory,
	unicodeEmojiCategories as categories,
	getEmojiName,
	getUnicodeEmoji,
} from '@@/js/emojilist.js';
import type {
	UnicodeEmojiDef,
} from '@@/js/emojilist.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import * as os from '@/os.js';
import { isTouchUsing } from '@/utility/touch.js';
import { deviceKind } from '@/utility/device-kind.js';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import { customEmojiCategories, customEmojis, customEmojisMap } from '@/custom-emojis.js';
import { $i } from '@/i.js';
import { checkReactionPermissions } from '@/utility/check-reaction-permissions.js';
import { prefer } from '@/preferences.js';
import { useRouter } from '@/router.js';
import { haptic } from '@/utility/haptic.js';

const router = useRouter();

const props = withDefaults(defineProps<{
	showPinned?: boolean;
	pinnedEmojis?: string[];
	maxHeight?: number;
	asDrawer?: boolean;
	asWindow?: boolean;
	asReactionPicker?: boolean; // 今は使われてないが将来的に使いそう
	targetNote?: Misskey.entities.Note | null;
}>(), {
	showPinned: true,
});

const emit = defineEmits<{
	(ev: 'chosen', v: string): void;
	(ev: 'esc'): void;
}>();

const searchEl = useTemplateRef('searchEl');
const emojisEl = useTemplateRef('emojisEl');

const {
	emojiPickerScale,
	emojiPickerWidth,
	emojiPickerHeight,
} = prefer.r;

const recentlyUsedEmojis = store.r.recentlyUsedEmojis;

const recentlyUsedEmojisDef = computed(() => {
	return recentlyUsedEmojis.value.map(getDef);
});
const pinnedEmojisDef = computed(() => {
	return pinned.value?.map(getDef);
});

const pinned = computed(() => props.pinnedEmojis);
const size = computed(() => emojiPickerScale.value);
const width = computed(() => emojiPickerWidth.value);
const height = computed(() => emojiPickerHeight.value);
const q = ref<string>('');
const searchResultCustom = ref<Misskey.entities.EmojiSimple[]>([]);
const searchResultUnicode = ref<UnicodeEmojiDef[]>([]);

type PickerEmoji = string | Misskey.entities.EmojiSimple | UnicodeEmojiDef;
type PickerCategory = {
	key: string;
	label: string;
	icon: string;
	items: PickerEmoji[];
};

const unicodeCategoryIcons: Record<string, string> = {
	face: 'ti ti-mood-smile',
	people: 'ti ti-hand-stop',
	animals_and_nature: 'ti ti-paw',
	food_and_drink: 'ti ti-apple',
	activity: 'ti ti-ball-football',
	travel_and_places: 'ti ti-car',
	objects: 'ti ti-bulb',
	symbols: 'ti ti-heart',
	flags: 'ti ti-flag',
};

const pickerCategories = computed<PickerCategory[]>(() => {
	const result: PickerCategory[] = [];
	const pinnedItems = pinnedEmojisDef.value ?? [];
	if (props.showPinned && pinnedItems.length > 0) {
		result.push({ key: 'pinned', label: i18n.ts.pinned, icon: 'ti ti-pin', items: pinnedItems });
	}
	if (recentlyUsedEmojisDef.value.length > 0) {
		result.push({ key: 'recent', label: i18n.ts.recentUsed, icon: 'ti ti-clock', items: recentlyUsedEmojisDef.value });
	}
	const customCategories = ['', ...customEmojiCategories.value.filter((category): category is string => category !== null && category !== '')];
	for (const category of customCategories) {
		const items = customEmojis.value.filter(emoji => filterCategory(emoji, category));
		if (items.length === 0) continue;
		result.push({
			key: `custom:${category || '__uncategorized__'}`,
			label: category || i18n.ts.other,
			icon: category === '' ? 'ti ti-sparkles' : 'ti ti-folder',
			items,
		});
	}
	for (const category of categories) {
		result.push({
			key: `unicode:${category}`,
			label: category.replaceAll('_', ' '),
			icon: unicodeCategoryIcons[category] ?? 'ti ti-mood-happy',
			items: emojiCharByCategory.get(category) ?? [],
		});
	}
	return result;
});

const searchResults = computed<PickerEmoji[]>(() => [
	...searchResultCustom.value,
	...searchResultUnicode.value,
]);
const activeCategoryIndex = ref(0);
const categoryRailEl = useTemplateRef('categoryRailEl');
const carouselEl = useTemplateRef('carouselEl');
let categorySyncFrame: number | null = null;

watch(q, () => {
	if (emojisEl.value) emojisEl.value.scrollTop = 0;

	if (q.value === '') {
		searchResultCustom.value = [];
		searchResultUnicode.value = [];
		nextTick(() => selectCategory(activeCategoryIndex.value, 'auto'));
		return;
	}

	const newQ = q.value.replace(/:/g, '').toLowerCase();

	const searchCustom = () => {
		const max = 100;
		const emojis = customEmojis.value;
		const matches = new Set<Misskey.entities.EmojiSimple>();

		const exactMatch = emojis.find(emoji => emoji.name === newQ);
		if (exactMatch) matches.add(exactMatch);

		if (newQ.includes(' ')) { // AND検索
			const keywords = newQ.split(' ');

			// 名前にキーワードが含まれている
			for (const emoji of emojis) {
				if (keywords.every(keyword => emoji.name.includes(keyword))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			// 名前またはエイリアスにキーワードが含まれている
			for (const emoji of emojis) {
				if (keywords.every(keyword => emoji.name.includes(keyword) || emoji.aliases.some(alias => alias.includes(keyword)))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
		} else {
			if (customEmojisMap.has(newQ)) {
				matches.add(customEmojisMap.get(newQ)!);
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (emoji.aliases.some(alias => alias === newQ)) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (emoji.name.startsWith(newQ)) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (emoji.aliases.some(alias => alias.startsWith(newQ))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (emoji.name.includes(newQ)) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (emoji.aliases.some(alias => alias.includes(newQ))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
		}

		return matches;
	};

	const searchUnicode = () => {
		const max = 100;
		const emojis = emojilist;
		const matches = new Set<UnicodeEmojiDef>();

		const exactMatch = emojis.find(emoji => emoji.name === newQ);
		if (exactMatch) matches.add(exactMatch);

		if (newQ.includes(' ')) { // AND検索
			const keywords = newQ.split(' ');

			for (const emoji of emojis) {
				if (keywords.every(keyword => emoji.name.includes(keyword))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const index of Object.values(store.s.additionalUnicodeEmojiIndexes)) {
				for (const emoji of emojis) {
					if (keywords.every(keyword => index[emoji.char]?.some(k => k.includes(keyword)))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
		} else {
			for (const emoji of emojis) {
				if (emoji.name.startsWith(newQ)) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const index of Object.values(store.s.additionalUnicodeEmojiIndexes)) {
				for (const emoji of emojis) {
					if (index[emoji.char]?.some(k => k.startsWith(newQ))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}

			for (const emoji of emojis) {
				if (emoji.name.includes(newQ)) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			for (const index of Object.values(store.s.additionalUnicodeEmojiIndexes)) {
				for (const emoji of emojis) {
					if (index[emoji.char]?.some(k => k.includes(newQ))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
		}

		return matches;
	};

	searchResultCustom.value = Array.from(searchCustom());
	searchResultUnicode.value = Array.from(searchUnicode());
});

function clampCategoryIndex(index: number): number {
	return Math.max(0, Math.min(index, pickerCategories.value.length - 1));
}

function centerCategoryButton(index: number, behavior: ScrollBehavior = 'smooth') {
	const rail = categoryRailEl.value;
	if (rail == null) return;
	const button = rail.children.item(index) as HTMLElement | null;
	if (button == null) return;
	rail.scrollTo({
		left: button.offsetLeft - ((rail.clientWidth - button.offsetWidth) / 2),
		behavior,
	});
}

function selectCategory(index: number, behavior: ScrollBehavior = 'smooth') {
	if (pickerCategories.value.length === 0) return;
	const nextIndex = clampCategoryIndex(index);
	activeCategoryIndex.value = nextIndex;
	centerCategoryButton(nextIndex, behavior);

	const carousel = carouselEl.value;
	if (carousel == null) return;
	const pane = carousel.querySelector<HTMLElement>(`[data-picker-category-index="${nextIndex}"]`);
	if (pane == null) return;
	carousel.scrollTo({
		left: pane.offsetLeft - ((carousel.clientWidth - pane.offsetWidth) / 2),
		behavior,
	});
}

function onCarouselScroll() {
	if (categorySyncFrame != null) return;
	categorySyncFrame = window.requestAnimationFrame(() => {
		categorySyncFrame = null;
		const carousel = carouselEl.value;
		if (carousel == null) return;
		const center = carousel.scrollLeft + (carousel.clientWidth / 2);
		let nearestIndex = activeCategoryIndex.value;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (const pane of carousel.querySelectorAll<HTMLElement>('[data-picker-category-index]')) {
			const paneCenter = pane.offsetLeft + (pane.offsetWidth / 2);
			const distance = Math.abs(paneCenter - center);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestIndex = Number(pane.dataset.pickerCategoryIndex ?? 0);
			}
		}
		if (nearestIndex !== activeCategoryIndex.value) {
			activeCategoryIndex.value = nearestIndex;
			centerCategoryButton(nearestIndex, 'smooth');
		}
	});
}

function shouldRenderCategory(index: number): boolean {
	return Math.abs(activeCategoryIndex.value - index) <= 1;
}

function isCustomEmoji(emoji: PickerEmoji): boolean {
	if (typeof emoji === 'string') return emoji.startsWith(':');
	return !('char' in emoji);
}

function emojiTitle(emoji: PickerEmoji): string {
	const key = getKey(emoji);
	return isCustomEmoji(emoji) ? key.replaceAll(':', '') : getEmojiName(key);
}

function canReact(emoji: Misskey.entities.EmojiSimple | UnicodeEmojiDef | string): boolean {
	return !props.targetNote || checkReactionPermissions($i!, props.targetNote, emoji);
}

function filterCategory(emoji: Misskey.entities.EmojiSimple, category: string): boolean {
	return category === '' ? (emoji.category === 'null' || !emoji.category) : emoji.category === category;
}

function focus() {
	if (!['smartphone', 'tablet'].includes(deviceKind) && !isTouchUsing) {
		searchEl.value?.focus({
			preventScroll: true,
		});
	}
}

function reset() {
	if (emojisEl.value) emojisEl.value.scrollTop = 0;
	q.value = '';
	activeCategoryIndex.value = 0;
	window.requestAnimationFrame(() => selectCategory(0, 'auto'));
}

function getKey(emoji: string | Misskey.entities.EmojiSimple | UnicodeEmojiDef): string {
	return typeof emoji === 'string' ? emoji : 'char' in emoji ? emoji.char : `:${emoji.name}:`;
}

function getDef(emoji: string): string | Misskey.entities.EmojiSimple | UnicodeEmojiDef {
	if (emoji.includes(':')) {
		// カスタム絵文字が存在する場合はその情報を持つオブジェクトを返し、
		// サーバの管理画面から削除された等で情報が見つからない場合は名前の文字列をそのまま返しておく（undefinedを返すとエラーになるため）
		const name = emoji.replaceAll(':', '');
		return customEmojisMap.get(name) ?? emoji;
	} else {
		return getUnicodeEmoji(emoji);
	}
}

/** @see MkEmojiPicker.section.vue */
function computeButtonTitle(ev: PointerEvent): void {
	const elm = ev.target as HTMLElement;
	const emoji = elm.dataset.emoji as string;
	elm.title = getEmojiName(emoji);
}

function chosen(emoji: string | Misskey.entities.EmojiSimple | UnicodeEmojiDef, ev?: PointerEvent) {
	const el = ev && (ev.currentTarget ?? ev.target) as HTMLElement | null | undefined;
	if (el && prefer.s.animation) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + (el.offsetWidth / 2);
		const y = rect.top + (el.offsetHeight / 2);
		const { dispose } = os.popup(MkRippleEffect, { x, y }, {
			end: () => dispose(),
		});
	}

	const key = getKey(emoji);
	emit('chosen', key);

	haptic();

	// 最近使った絵文字更新
	if (!pinned.value?.includes(key)) {
		let recents = store.s.recentlyUsedEmojis;
		recents = recents.filter((emoji) => emoji !== key);
		recents.unshift(key);
		store.set('recentlyUsedEmojis', recents.splice(0, 32));
	}
}

function input(): void {
	// Using custom input event instead of v-model to respond immediately on
	// Android, where composition happens on all languages
	// (v-model does not update during composition)
	q.value = searchEl.value?.value.trim() ?? '';
}

function paste(event: ClipboardEvent): void {
	const pasted = event.clipboardData?.getData('text') ?? '';
	if (done(pasted)) {
		event.preventDefault();
	}
}

function onKeydown(ev: KeyboardEvent) {
	if (ev.isComposing || ev.key === 'Process' || ev.keyCode === 229) return;
	if (ev.key === 'Enter') {
		ev.preventDefault();
		ev.stopPropagation();
		done();
	}
	if (ev.key === 'Escape') {
		ev.preventDefault();
		ev.stopPropagation();
		emit('esc');
	}
}

function done(query?: string): boolean | void {
	if (query == null) query = q.value;
	if (query == null || typeof query !== 'string') return;

	const q2 = query.replace(/:/g, '');
	const exactMatchCustom = customEmojisMap.get(q2);
	if (exactMatchCustom) {
		chosen(exactMatchCustom);
		return true;
	}
	const exactMatchUnicode = emojilist.find(emoji => emoji.char === q2 || emoji.name === q2);
	if (exactMatchUnicode) {
		chosen(exactMatchUnicode);
		return true;
	}
	if (searchResultCustom.value.length > 0) {
		chosen(searchResultCustom.value[0]);
		return true;
	}
	if (searchResultUnicode.value.length > 0) {
		chosen(searchResultUnicode.value[0]);
		return true;
	}
}

watch(pickerCategories, (nextCategories) => {
	if (nextCategories.length === 0) return;
	const nextIndex = clampCategoryIndex(activeCategoryIndex.value);
	if (nextIndex !== activeCategoryIndex.value) activeCategoryIndex.value = nextIndex;
	if (!q.value) window.requestAnimationFrame(() => selectCategory(nextIndex, 'auto'));
}, { flush: 'post' });

function settings() {
	emit('esc');
	router.push('/settings/emoji-palette');
}

onMounted(() => {
	focus();
	window.requestAnimationFrame(() => selectCategory(activeCategoryIndex.value, 'auto'));
});

onBeforeUnmount(() => {
	if (categorySyncFrame != null) window.cancelAnimationFrame(categorySyncFrame);
});

defineExpose({
	focus,
	reset,
});
</script>

<style lang="scss" scoped>
.omfetrab {
	--eachSize: 50px;
	--columns: 7;
	--rows: 8;
	--pickerPeek: clamp(28px, 8%, 40px);
	--pickerGap: 8px;
	--misutgaru-material-surface: var(--MI_THEME-panel);
	--misutgaru-material-fallback: var(--MI_THEME-panel);

	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	width: calc((var(--eachSize) * var(--columns)) + 20px);
	height: calc((var(--eachSize) * var(--rows)) + 98px);
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	border-radius: 18px;
	corner-shape: round;
	color: var(--MI_THEME-fg);

	&.s1 { --eachSize: 40px; }
	&.s2 { --eachSize: 45px; }
	&.s3 { --eachSize: 50px; }
	&.s4 { --eachSize: 55px; }
	&.s5 { --eachSize: 60px; }
	&.w1 { --columns: 5; }
	&.w2 { --columns: 6; }
	&.w3 { --columns: 7; }
	&.w4 { --columns: 8; }
	&.w5 { --columns: 9; }
	&.h1 { --rows: 4; }
	&.h2 { --rows: 6; }
	&.h3 { --rows: 8; }
	&.h4 { --rows: 10; }

	&.asDrawer {
		width: 100% !important;
		max-width: 600px;
		border-radius: 20px 20px 0 0;
	}

	&.asWindow {
		width: 100% !important;
		height: 100% !important;
		border-radius: 0;
	}
}

.top {
	position: relative;
	z-index: 3;
	flex: 0 0 auto;
	padding: 10px 10px 4px;
}

.searchShell {
	display: flex;
	align-items: center;
	min-height: 38px;
	border-radius: 13px;
	corner-shape: round;
	background: color-mix(in srgb, var(--MI_THEME-bg) 68%, transparent);
	box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--MI_THEME-fg) 7%, transparent);
	color: color-mix(in srgb, var(--MI_THEME-fg) 52%, transparent);
	transition: background 0.2s ease, box-shadow 0.2s ease;

	&:focus-within {
		background: color-mix(in srgb, var(--MI_THEME-bg) 82%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--MI_THEME-accent) 48%, transparent), 0 0 0 3px color-mix(in srgb, var(--MI_THEME-accent) 9%, transparent);
		color: var(--MI_THEME-accent);
	}
}

.searchIcon {
	flex: 0 0 auto;
	width: 20px;
	margin-left: 11px;
	font-size: 15px;
	text-align: center;
}

.search {
	box-sizing: border-box;
	flex: 1 1 auto;
	min-width: 0;
	min-height: 38px;
	padding: 0 7px;
	border: 0;
	outline: 0;
	background: transparent;
	color: var(--MI_THEME-fg);
	font: inherit;

	&::placeholder {
		color: color-mix(in srgb, var(--MI_THEME-fg) 42%, transparent);
	}

	&::-webkit-search-cancel-button {
		display: none;
	}
}

.searchAction {
	flex: 0 0 auto;
	display: grid;
	place-items: center;
	width: 30px;
	height: 30px;
	margin-right: 4px;
	border-radius: 10px;
	color: color-mix(in srgb, var(--MI_THEME-fg) 54%, transparent);

	&:hover,
	&:focus-visible {
		background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
		color: var(--MI_THEME-accent);
		outline: none;
	}
}

.categoryRail {
	display: flex;
	align-items: center;
	gap: 5px;
	margin-top: 5px;
	padding: 2px calc(50% - 18px) 3px;
	overflow-x: auto;
	overflow-y: hidden;
	scroll-snap-type: x proximity;
	scrollbar-width: none;
	overscroll-behavior-inline: contain;
	-webkit-mask-image: linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%);
	mask-image: linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%);

	&::-webkit-scrollbar {
		display: none;
	}
}

.categoryButton {
	flex: 0 0 34px;
	display: grid;
	place-items: center;
	width: 34px;
	height: 34px;
	border-radius: 11px;
	color: color-mix(in srgb, var(--MI_THEME-fg) 42%, transparent);
	font-size: 17px;
	scroll-snap-align: center;
	transition: opacity 0.2s ease, transform 0.24s cubic-bezier(.2,.8,.2,1), color 0.2s ease, background 0.2s ease;

	&:hover,
	&:focus-visible {
		background: color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);
		color: color-mix(in srgb, var(--MI_THEME-fg) 75%, transparent);
		outline: none;
	}
}

.categoryButtonActive {
	background: color-mix(in srgb, var(--MI_THEME-accent) 13%, transparent);
	color: var(--MI_THEME-accent);
	transform: scale(1.08);
}

.carouselShell {
	position: relative;
	z-index: 2;
	flex: 1 1 auto;
	min-height: 0;
	overflow: hidden;

	&::before,
	&::after {
		content: '';
		position: absolute;
		z-index: 5;
		top: 0;
		bottom: 0;
		width: 15px;
		pointer-events: none;
	}

	&::before {
		left: 0;
		background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-panel) 74%, transparent), transparent);
	}

	&::after {
		right: 0;
		background: linear-gradient(270deg, color-mix(in srgb, var(--MI_THEME-panel) 74%, transparent), transparent);
	}
}

.categoryCarousel {
	display: flex;
	gap: var(--pickerGap);
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	padding: 2px var(--pickerPeek) 8px;
	overflow-x: auto;
	overflow-y: hidden;
	scroll-snap-type: x mandatory;
	scrollbar-width: none;
	overscroll-behavior-inline: contain;

	&::-webkit-scrollbar {
		display: none;
	}
}

.categoryPane {
	flex: 0 0 calc(100% - (var(--pickerPeek) * 2));
	box-sizing: border-box;
	height: 100%;
	min-width: 0;
	padding: 3px 4px 18px;
	overflow-x: hidden;
	overflow-y: auto;
	scroll-snap-align: center;
	scroll-snap-stop: always;
	scrollbar-width: thin;
	overscroll-behavior-y: contain;
	opacity: 0.08;
	filter: blur(7px) saturate(0.65);
	transform: scale(0.955);
	transform-origin: center center;
	pointer-events: none;
	transition: opacity 0.22s ease, filter 0.28s ease, transform 0.28s cubic-bezier(.2,.8,.2,1);
}

.categoryPaneNeighbor {
	opacity: 0.26;
	filter: blur(5px) saturate(0.72);
	transform: scale(0.972);
}

.categoryPaneActive {
	opacity: 1;
	filter: none;
	transform: scale(1);
	pointer-events: auto;
}

.searchResults {
	position: relative;
	z-index: 2;
	flex: 1 1 auto;
	min-height: 0;
	padding: 7px 12px 16px;
	overflow-y: auto;
	scrollbar-width: thin;
	overscroll-behavior: contain;
}

.emojiGrid {
	display: grid;
	grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
	align-content: start;
	gap: 2px;
	width: 100%;
}

.emojiItem {
	position: relative;
	display: grid;
	place-items: center;
	aspect-ratio: 1;
	min-width: 0;
	padding: 4px;
	border-radius: 11px;
	font-size: clamp(21px, calc(var(--eachSize) * 0.56), 30px);
	contain: layout paint;
	transition: background 0.15s ease, transform 0.15s ease;

	&:hover,
	&:focus-visible {
		background: color-mix(in srgb, var(--MI_THEME-fg) 7%, transparent);
		outline: none;
	}

	&:active {
		background: color-mix(in srgb, var(--MI_THEME-accent) 17%, transparent);
		transform: scale(0.92);
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.34;
		filter: grayscale(0.8);
	}

	> .emoji {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}
}

.empty {
	display: grid;
	place-items: center;
	min-height: 120px;
	color: color-mix(in srgb, var(--MI_THEME-fg) 42%, transparent);
	font-size: 12px;
}

.visuallyHidden {
	position: absolute !important;
	width: 1px !important;
	height: 1px !important;
	padding: 0 !important;
	margin: -1px !important;
	overflow: hidden !important;
	clip: rect(0 0 0 0) !important;
	white-space: nowrap !important;
	border: 0 !important;
}

@media (max-width: 520px) {
	.omfetrab {
		--pickerPeek: 30px;
		border-radius: 17px 17px 0 0;
	}

	.top {
		padding: 8px 8px 3px;
	}

	.categoryCarousel {
		padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
	}
}

@media (prefers-reduced-motion: reduce) {
	.searchShell,
	.categoryButton,
	.categoryPane,
	.emojiItem {
		transition: none;
	}
}
</style>
