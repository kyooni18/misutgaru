<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeMkEmojiPickerHost ref="pickerRoot" :model="nativeModel" :class="$attrs.class" :style="$attrs.style"/>
<!--
	<input
		ref="searchEl"
		:value="q"
		class="search"
		data-prevent-emoji-insert
		:class="{ filled: q != null && q != '' }"
		:placeholder="i18n.ts.search"
		type="search"
		autocapitalize="off"
		@input="input()"
		@paste.stop="paste"
		@keydown="onKeydown"
	>
	FirefoxのTabフォーカスが想定外の挙動となるためtabindex="-1"を追加 https://github.com/misskey-dev/misskey/issues/10744
	<div ref="emojisEl" class="emojis" tabindex="-1">
		<section class="result">
			<div v-if="searchResultCustom.length > 0" class="body">
				<button
					v-for="emoji in searchResultCustom"
					:key="emoji.name"
					class="_button item"
					:disabled="!canReact(emoji)"
					:title="emoji.name"
					tabindex="0"
					@click="chosen(emoji, $event)"
				>
					<MkCustomEmoji class="emoji" :name="emoji.name" :fallbackToImage="true"/>
				</button>
			</div>
			<div v-if="searchResultUnicode.length > 0" class="body">
				<button
					v-for="emoji in searchResultUnicode"
					:key="emoji.name"
					class="_button item"
					:title="emoji.name"
					tabindex="0"
					@click="chosen(emoji, $event)"
				>
					<MkEmoji class="emoji" :emoji="emoji.char"/>
				</button>
			</div>
		</section>

		<div v-if="tab === 'index'" class="group index">
			<section v-if="showPinned && (pinned && pinned.length > 0)">
				<div class="body">
					<button
						v-for="emoji in pinnedEmojisDef"
						:key="getKey(emoji)"
						:data-emoji="getKey(emoji)"
						class="_button item"
						:disabled="!canReact(emoji)"
						tabindex="0"
						@pointerenter="computeButtonTitle"
						@click="chosen(emoji, $event)"
					>
						<MkCustomEmoji v-if="!emoji.hasOwnProperty('char')" class="emoji" :name="getKey(emoji)" :normal="true"/>
						<MkEmoji v-else class="emoji" :emoji="getKey(emoji)" :normal="true"/>
					</button>
					<button v-tooltip="i18n.ts.settings" class="_button config" @click="settings"><i class="ti ti-settings"></i></button>
				</div>
			</section>

			<section>
				<header class="_acrylic"><i class="ti ti-clock ti-fw"></i> {{ i18n.ts.recentUsed }}</header>
				<div class="body">
					<button
						v-for="emoji in recentlyUsedEmojisDef"
						:key="getKey(emoji)"
						class="_button item"
						:disabled="!canReact(emoji)"
						:data-emoji="getKey(emoji)"
						@pointerenter="computeButtonTitle"
						@click="chosen(emoji, $event)"
					>
						<MkCustomEmoji v-if="!emoji.hasOwnProperty('char')" class="emoji" :name="getKey(emoji)" :normal="true"/>
						<MkEmoji v-else class="emoji" :emoji="getKey(emoji)" :normal="true"/>
					</button>
				</div>
			</section>
		</div>
		<div v-once class="group">
			<header class="_acrylic">{{ i18n.ts.customEmojis }}</header>
			<XSection
				v-for="child in customEmojiFolderRoot.children"
				:key="`custom:${child.value}`"
				:initialShown="false"
				:emojis="computed(() => customEmojis.filter(e => filterCategory(e, child.value)).map(e => `:${e.name}:`))"
				:disabledEmojis="computed(() => customEmojis.filter(e => filterCategory(e, child.value)).filter(e => !canReact(e)).map(e => `:${e.name}:`))"
				:hasChildSection="child.children.length !== 0"
				:customEmojiTree="child.children"
				@chosen="chosen"
			>
				{{ child.value || i18n.ts.other }}
			</XSection>
		</div>
		<div v-once class="group">
			<header class="_acrylic">{{ i18n.ts.emoji }}</header>
			<XSection v-for="category in categories" :key="category" :emojis="emojiCharByCategory.get(category) ?? []" :hasChildSection="false" @chosen="chosen">{{ category }}</XSection>
		</div>
	</div>
	<div class="tabs">
		<button class="_button tab" :class="{ active: tab === 'index' }" @click="tab = 'index'"><i class="ti ti-asterisk ti-fw"></i></button>
		<button class="_button tab" :class="{ active: tab === 'custom' }" @click="tab = 'custom'"><i class="ti ti-mood-happy ti-fw"></i></button>
		<button class="_button tab" :class="{ active: tab === 'unicode' }" @click="tab = 'unicode'"><i class="ti ti-leaf ti-fw"></i></button>
		<button class="_button tab" :class="{ active: tab === 'tags' }" @click="tab = 'tags'"><i class="ti ti-hash ti-fw"></i></button>
	</div>
</div>
-->
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, computed, watch, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import {
	emojilist,
	emojiCharByCategory,
	unicodeEmojiCategories as categories,
	colorizeEmoji,
	getEmojiName,
	getUnicodeEmoji,
} from '@@/js/emojilist.js';
import type { UnicodeEmojiDef } from '@@/js/emojilist.js';
import { char2fluentEmojiFilePath, char2twemojiFilePath } from '@@/js/emoji-base.js';
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
import NativeMkEmojiPicker from '@/components/vune/MkEmojiPicker.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import { getProxiedImageUrl, getStaticImageUrl } from '@/utility/media-proxy.js';
import type { NativeEmojiPickerGroup, NativeEmojiPickerItem, NativeEmojiPickerModel, NativeEmojiPickerSection } from '@/components/vune/MkEmojiPicker.types.js';

const router = useRouter();
const NativeMkEmojiPickerHost = createVuneWebHost(NativeMkEmojiPicker);

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

const pickerRoot = useTemplateRef('pickerRoot');

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
const q = ref<string>('');
const searchResultCustom = ref<Misskey.entities.EmojiSimple[]>([]);
const searchResultUnicode = ref<UnicodeEmojiDef[]>([]);

const expandedSections = new Map<string, boolean>();

const unicodeCategoryMeta: Record<UnicodeEmojiDef['category'], { title: string; icon: string }> = {
	face: { title: 'Face', icon: 'ti ti-mood-smile' },
	people: { title: 'People', icon: 'ti ti-users' },
	animals_and_nature: { title: 'Animals & nature', icon: 'ti ti-leaf' },
	food_and_drink: { title: 'Food & drink', icon: 'ti ti-tools-kitchen-2' },
	activity: { title: 'Activity', icon: 'ti ti-ball-football' },
	travel_and_places: { title: 'Travel & places', icon: 'ti ti-plane' },
	objects: { title: 'Objects', icon: 'ti ti-bulb' },
	symbols: { title: 'Symbols', icon: 'ti ti-hash' },
	flags: { title: 'Flags', icon: 'ti ti-flag' },
};

watch(q, () => {
	if (q.value === '') {
		searchResultCustom.value = [];
		searchResultUnicode.value = [];
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

function canReact(emoji: Misskey.entities.EmojiSimple | UnicodeEmojiDef | string): boolean {
	return !props.targetNote || checkReactionPermissions($i!, props.targetNote, emoji);
}

function filterCategory(emoji: Misskey.entities.EmojiSimple, category: string): boolean {
	return category === '' ? (emoji.category === 'null' || !emoji.category) : emoji.category === category;
}

function focus() {
	if (!['smartphone', 'tablet'].includes(deviceKind) && !isTouchUsing) {
		const root = (pickerRoot.value as unknown as { $el?: HTMLElement } | null)?.$el;
		root?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
	}
}

function reset() {
	q.value = '';
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

function settings() {
	emit('esc');
	router.push('/settings/emoji-palette');
}

function pickerItem(value: string | Misskey.entities.EmojiSimple | UnicodeEmojiDef): NativeEmojiPickerItem {
	const key = getKey(value);
	const custom = key.startsWith(':');
	const muted = prefer.r.mutingEmojis.value.includes(key);
	if (muted) {
		return {
			key,
			disabled: !canReact(value),
			title: custom ? key.slice(1, -1) : getEmojiName(key),
			imageUrl: '/client-assets/unknown.png',
		};
	}

	if (!custom) {
		const emojiStyle = prefer.s.emojiStyle;
		return {
			key,
			disabled: !canReact(value),
			title: getEmojiName(key),
			...(emojiStyle === 'native'
				? { text: colorizeEmoji(key) }
				: { imageUrl: (emojiStyle === 'twemoji' ? char2twemojiFilePath : char2fluentEmojiFilePath)(key) }),
		};
	}

	const customEmoji = typeof value === 'object' && !('char' in value)
		? value
		: customEmojisMap.get(key.slice(1, -1));
	const rawUrl = customEmoji?.url;
	const proxiedUrl = rawUrl == null
		? '/client-assets/dummy.png'
		: rawUrl.startsWith('/emoji/')
			? `${rawUrl}?fallback=1`
			: getProxiedImageUrl(rawUrl, 'emoji', false, true);
	const imageUrl = prefer.s.disableShowingAnimatedImages ? getStaticImageUrl(proxiedUrl) : proxiedUrl;
	return {
		key,
		disabled: !canReact(value),
		title: key.slice(1, -1),
		imageUrl,
		fallbackUrl: '/client-assets/dummy.png',
	};
}

function sectionItems(values: Array<string | Misskey.entities.EmojiSimple | UnicodeEmojiDef>): NativeEmojiPickerItem[] {
	return values.map(pickerItem);
}

function toggleSection(key: string): void {
	expandedSections.set(key, !(expandedSections.get(key) ?? false));
	nativeModel.value = buildNativeModel();
}

function makeSection(key: string, title: string, icon: string, values: Array<string | Misskey.entities.EmojiSimple | UnicodeEmojiDef>): NativeEmojiPickerSection {
	return {
		key,
		title,
		icon,
		count: values.length,
		emojis: sectionItems(values),
		expanded: expandedSections.get(key) ?? false,
		onToggle: () => toggleSection(key),
	};
}

function groupCount(sections: NativeEmojiPickerSection[]): number {
	return sections.reduce((total, section) => total + section.count, 0);
}

function buildNativeModel(): NativeEmojiPickerModel {
	const columnsByWidth = [0, 5, 6, 7, 8, 9];
	const sizeByScale = [0, 38, 42, 46, 50, 54];
	const columns = columnsByWidth[emojiPickerWidth.value] ?? 7;
	const itemSize = sizeByScale[emojiPickerScale.value] ?? 46;
	const customCategories = ['', ...customEmojiCategories.value.filter((category): category is string => category !== null && category !== '')];
	const customSections = customCategories.map(category => makeSection(
		`custom:${category}`,
		category || i18n.ts.other,
		category === '' ? 'ti ti-sparkles' : 'ti ti-folder',
		customEmojis.value.filter(emoji => filterCategory(emoji, category)),
	)).filter(section => section.count > 0);
	const unicodeSections = categories.map(category => {
		const meta = unicodeCategoryMeta[category];
		return makeSection(
			`unicode:${category}`,
			meta.title,
			meta.icon,
			(emojiCharByCategory.get(category) ?? []).map(char => getUnicodeEmoji(char)).filter((emoji): emoji is UnicodeEmojiDef => typeof emoji !== 'string'),
		);
	});
	const groups: NativeEmojiPickerGroup[] = [
		{ key: 'custom', title: i18n.ts.customEmojis, icon: 'ti ti-icons', count: groupCount(customSections), sections: customSections },
		{ key: 'unicode', title: i18n.ts.emoji, icon: 'ti ti-mood-happy', count: groupCount(unicodeSections), sections: unicodeSections },
	].filter(group => group.count > 0);
	const results = [...searchResultCustom.value, ...searchResultUnicode.value].map(pickerItem);
	return {
		query: q.value,
		placeholder: i18n.ts.search,
		width: columns * itemSize + 24,
		height: (emojiPickerHeight.value === 1 ? 4 : emojiPickerHeight.value === 2 ? 6 : emojiPickerHeight.value === 3 ? 8 : 10) * itemSize + 28,
		columns,
		itemSize,
		maxHeight: props.maxHeight,
		asDrawer: props.asDrawer ?? false,
		asWindow: props.asWindow ?? false,
		pinned: props.showPinned ? sectionItems(pinnedEmojisDef.value ?? []) : [],
		recent: sectionItems(recentlyUsedEmojisDef.value),
		results,
		resultLabel: `${i18n.ts.search} · ${results.length}`,
		groups,
		onQuery: (value: string) => { q.value = value.trim(); },
		onPaste: (value: string) => done(value) === true,
		onSubmit: () => { done(); },
		onChoose: (key: string) => chosen(getDef(key)),
		onSettings: settings,
		onEscape: () => emit('esc'),
	};
}

const nativeModel = ref<NativeEmojiPickerModel>(buildNativeModel());
watch([
	q,
	recentlyUsedEmojis,
	customEmojis,
	emojiPickerScale,
	emojiPickerWidth,
	emojiPickerHeight,
	prefer.r.mutingEmojis,
	() => prefer.s.emojiStyle,
	() => prefer.s.disableShowingAnimatedImages,
], () => {
	nativeModel.value = buildNativeModel();
}, { deep: true });

onMounted(() => {
	focus();
});

defineExpose({
	focus,
	reset,
});
</script>

<style lang="scss" scoped>
.omfetrab {
	$pad: 8px;

	display: flex;
	flex-direction: column;

	&.s1 {
		--eachSize: 40px;
	}

	&.s2 {
		--eachSize: 45px;
	}

	&.s3 {
		--eachSize: 50px;
	}

	&.s4 {
		--eachSize: 55px;
	}

	&.s5 {
		--eachSize: 60px;
	}

	&.w1 {
		--columns: 5;
	}

	&.w2 {
		--columns: 6;
	}

	&.w3 {
		--columns: 7;
	}

	&.w4 {
		--columns: 8;
	}

	&.w5 {
		--columns: 9;
	}

	&.h1 {
		--rows: 4;
	}

	&.h2 {
		--rows: 6;
	}

	&.h3 {
		--rows: 8;
	}

	&.h4 {
		--rows: 10;
	}

	width: calc((var(--eachSize) * var(--columns)) + (#{$pad} * 2));
	height: calc((var(--eachSize) * var(--rows)) + (#{$pad} * 2));

	&.asDrawer {
		width: 100% !important;

		> .emojis {
			::v-deep(section) {
				> header {
					height: 32px;
					line-height: 32px;
					padding: 0 12px;
					font-size: 15px;
				}

				> .body {
					display: grid;
					grid-template-columns: repeat(var(--columns), 1fr);
					font-size: 30px;

					> .config {
						aspect-ratio: 1 / 1;
						width: auto;
						height: auto;
						min-width: 0;
						font-size: 14px;
					}

					> .item {
						aspect-ratio: 1 / 1;
						width: auto;
						height: auto;
						min-width: 0;

						&:disabled {
							cursor: not-allowed;
							background: linear-gradient(-45deg, transparent 0% 48%, light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.15)) 48% 52%, transparent 52% 100%);
							opacity: 1;

							> .emoji {
								filter: grayscale(1);
								mix-blend-mode: exclusion;
								opacity: 0.8;
							}
						}
					}
				}
			}
		}
	}

	&.asWindow {
		width: 100% !important;
		height: 100% !important;

		> .emojis {
			::v-deep(section) {
				> .body {
					display: grid;
					grid-template-columns: repeat(var(--columns), 1fr);
					font-size: 30px;

					> .item {
						aspect-ratio: 1 / 1;
						width: auto;
						height: auto;
						min-width: 0;
						padding: 0;

						&:disabled {
							cursor: not-allowed;
							background: linear-gradient(-45deg, transparent 0% 48%, light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.15)) 48% 52%, transparent 52% 100%);
							opacity: 1;

							> .emoji {
								filter: grayscale(1);
								mix-blend-mode: exclusion;
								opacity: 0.8;
							}
						}
					}
				}
			}
		}
	}

	> .search {
		width: 100%;
		padding: 12px;
		box-sizing: border-box;
		font-size: 1em;
		outline: none;
		border: none;
		background: transparent;
		color: var(--MI_THEME-fg);

		&:not(:focus):not(.filled) {
			margin-bottom: env(safe-area-inset-bottom, 0px);
		}

		&:not(.filled) {
			order: 1;
			z-index: 2;
			box-shadow: 0px -1px 0 0px var(--MI_THEME-divider);
		}
	}

	> .tabs {
		display: flex;
		display: none;

		> .tab {
			flex: 1;
			height: 38px;
			border-top: solid 0.5px var(--MI_THEME-divider);

			&.active {
				border-top: solid 1px var(--MI_THEME-accent);
				color: var(--MI_THEME-accent);
			}
		}
	}

	> .emojis {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;

		> .group {
			&:not(.index) {
				padding: 4px 0 8px 0;
				border-top: solid 0.5px var(--MI_THEME-divider);
			}

			> header {
				/*position: sticky;
				top: 0;
				left: 0;*/
				height: 32px;
				line-height: 32px;
				z-index: 2;
				padding: 0 8px;
				font-size: 12px;
			}
		}

		::v-deep(section) {
			> header {
				position: sticky;
				top: 0;
				left: 0;
				line-height: 28px;
				z-index: 1;
				padding: 0 8px;
				font-size: 12px;
				cursor: pointer;

				&:hover {
					color: var(--MI_THEME-accent);
				}
			}

			> .body {
				position: relative;
				padding: $pad;

				> .config {
					position: relative;
					padding: 0 3px;
					width: var(--eachSize);
					height: var(--eachSize);
					contain: strict;
					opacity: 0.5;
				}

				> .item {
					position: relative;
					padding: 0 3px;
					width: var(--eachSize);
					height: var(--eachSize);
					contain: strict;
					border-radius: 4px;
					font-size: 24px;

					&:hover {
						background: rgba(0, 0, 0, 0.05);
					}

					&:active {
						background: var(--MI_THEME-accent);
						box-shadow: inset 0 0.15em 0.3em rgba(27, 31, 35, 0.15);
					}

					&:disabled {
						cursor: not-allowed;
						background: linear-gradient(-45deg, transparent 0% 48%, light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.15)) 48% 52%, transparent 52% 100%);
						opacity: 1;

						> .emoji {
							filter: grayscale(1);
							mix-blend-mode: exclusion;
							opacity: 0.8;
						}
					}

					> .emoji {
						height: 1.25em;
						vertical-align: -.25em;
						pointer-events: none;
						width: 100%;
						object-fit: contain;
					}
				}
			}

			&.result {
				border-bottom: solid 0.5px var(--MI_THEME-divider);

				&:empty {
					display: none;
				}
			}
		}
	}
}
</style>
