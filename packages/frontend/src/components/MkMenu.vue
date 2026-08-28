<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	role="menu"
	:class="{
		[$style.root]: true,
		[$style.center]: align === 'center',
		[$style.big]: big,
		[$style.asDrawer]: asDrawer,
		[$style.widthSpecified]: width != null,
	}"
	@focusin.passive.stop="() => {}"
>
	<NativeMkMenuHost
		:model="nativeModel"
	/>
	<!--
	<div
		v-if="false"
		class="_popup _shadow"
		:class="[$style.surface, materialClass]"
		:data-vune-material="props.material ?? 'regular'"
	>
	<div
		ref="itemsEl"
		v-hotkey="keymap"
		tabindex="0"
		:class="$style.menu"
		:style="{
			width: (width && !asDrawer) ? `${width}px` : '',
			maxHeight: maxHeight ? `min(${maxHeight}px, calc(100dvh - 32px))` : 'calc(100dvh - 32px)',
		}"
		@keydown.stop="() => {}"
		@contextmenu.self.prevent="() => {}"
		@mousemove.passive="onMouseMove"
		@mouseleave.passive="onMouseLeave"
	>
		<template v-for="item in (items2 ?? [])">
			<div v-if="item.type === 'divider'" role="separator" tabindex="-1" :class="$style.divider"></div>

			<div v-else-if="item.type === 'label'" role="menuitem" tabindex="-1" :class="[$style.label]">
				<span>{{ item.text }}</span>
			</div>

			<span v-else-if="item.type === 'pending'" role="menuitem" tabindex="0" :class="[$style.pending, $style.item]">
				<span><MkEllipsis/></span>
			</span>

			<div v-else-if="item.type === 'component'" role="menuitem" tabindex="-1">
				<component :is="item.component" v-bind="item.props"/>
			</div>

			<MkA
				v-else-if="item.type === 'link'"
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item]"
				:to="item.to"
				@click.passive="close(true)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]"></i>
				<MkAvatar v-if="item.avatar" :user="item.avatar" :class="$style.avatar"/>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<span v-if="item.indicate" :class="$style.indicator" class="_blink"><i class="_indicatorCircle"></i></span>
				</div>
			</MkA>

			<a
				v-else-if="item.type === 'a'"
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item]"
				:href="item.href"
				:target="item.target"
				:rel="item.target === '_blank' ? 'noopener noreferrer' : undefined"
				:download="item.download"
				@click.passive="close(true)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]"></i>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<span v-if="item.indicate" :class="$style.indicator" class="_blink"><i class="_indicatorCircle"></i></span>
				</div>
			</a>

			<button
				v-else-if="item.type === 'user'"
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item, { [$style.active]: item.active }]"
				@click.prevent="item.active ? close(false) : clicked(item.action, $event)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<MkAvatar :user="item.user" :class="$style.avatar"/><MkUserName :user="item.user"/>
				<div v-if="item.indicate" :class="$style.item_content">
					<span :class="$style.indicator" class="_blink"><i class="_indicatorCircle"></i></span>
				</div>
			</button>

			<button
				v-else-if="item.type === 'switch'"
				role="menuitemcheckbox"
				tabindex="0"
				:class="['_button', $style.item]"
				:disabled="unref(item.disabled)"
				@click.prevent="switchItem(item)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]"></i>
				<MkSwitchButton v-else :class="$style.switchButton" :checked="item.ref" :disabled="item.disabled" @toggle="switchItem(item)"/>
				<div :class="$style.item_content">
					<div :class="[$style.item_content_text, { [$style.switchText]: !item.icon }]">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<MkSwitchButton v-if="item.icon" :class="[$style.switchButton, $style.caret]" :checked="item.ref" :disabled="item.disabled" @toggle="switchItem(item)"/>
				</div>
			</button>

			<button
				v-else-if="item.type === 'radio'"
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item, $style.parent, { [$style.active]: childShowingItem === item }]"
				:disabled="unref(item.disabled)"
				@mouseenter.prevent="preferClick ? null : showRadioOptions(item, $event)"
				@mousemove="parentMouseMove"
				@keydown.enter.prevent="preferClick ? null : showRadioOptions(item, $event)"
				@click.prevent="!preferClick ? null : showRadioOptions(item, $event)"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]" style="pointer-events: none;"></i>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text" style="pointer-events: none;">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<span :class="$style.caret" style="pointer-events: none;"><i class="ti ti-chevron-right ti-fw"></i></span>
				</div>
			</button>

			<button
				v-else-if="item.type === 'radioOption'"
				role="menuitemradio"
				tabindex="0"
				:class="['_button', $style.item, $style.radio, { [$style.active]: unref(item.active) }]"
				@click.prevent="unref(item.active) ? null : clicked(item.action, $event, false)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<div :class="$style.icon">
					<span :class="[$style.radioIcon, { [$style.radioChecked]: unref(item.active) }]"></span>
				</div>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
				</div>
			</button>

			<button
				v-else-if="item.type === 'parent'"
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item, $style.parent, { [$style.active]: childShowingItem === item }]"
				@mouseenter.prevent="preferClick ? null : showChildren(item, $event)"
				@mousemove="parentMouseMove"
				@keydown.enter.prevent="preferClick ? null : showChildren(item, $event)"
				@click.prevent="!preferClick ? null : showChildren(item, $event)"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]" style="pointer-events: none;"></i>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text" style="pointer-events: none;">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<span :class="$style.caret" style="pointer-events: none;"><i class="ti ti-chevron-right ti-fw"></i></span>
				</div>
			</button>

			<button
				v-else
				role="menuitem"
				tabindex="0"
				:class="['_button', $style.item, { [$style.danger]: item.danger, [$style.active]: unref(item.active) }]"
				@click.prevent="unref(item.active) ? close(false) : clicked(item.action, $event)"
				@mouseenter.passive="onItemMouseEnter"
				@mouseleave.passive="onItemMouseLeave"
			>
				<i v-if="item.icon" class="ti-fw" :class="[$style.icon, item.icon]"></i>
				<MkAvatar v-if="item.avatar" :user="item.avatar" :class="$style.avatar"/>
				<div :class="$style.item_content">
					<div :class="$style.item_content_text">
						<div :class="$style.item_content_text_title">{{ item.text }}</div>
						<div v-if="item.caption" :class="$style.item_content_text_caption">{{ item.caption }}</div>
					</div>
					<span v-if="item.indicate" :class="$style.indicator" class="_blink"><i class="_indicatorCircle"></i></span>
				</div>
			</button>
		</template>

		<span v-if="items2 == null || items2.length === 0" tabindex="-1" :class="[$style.none, $style.item]">
			<span>{{ i18n.ts.none }}</span>
		</span>

		<div
			:class="[$style.guard, { [$style.showGuard]: debugShowPredictionCone }]"
			:style="{ clipPath: guardPolygon, top: guard.top + 'px' }"
			@mousemove="guardMouseMove"
		></div>
	</div>
	</div>
	-->

	<XChild
		v-if="childMenu" :key="childMenuKey"
		ref="child"
		:items="childMenu"
		:anchorElement="childTarget!"
		:rootElement="itemsEl!"
		:material="props.material"
		:debugDisablePredictionCone="props.debugDisablePredictionCone"
		:debugShowPredictionCone="props.debugShowPredictionCone"
		@actioned="childActioned"
		@closed="closeChild"
	/>
</div>
</template>

<script lang="ts">
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, ref, useCssModule, useTemplateRef, unref, watch, shallowRef, reactive, isRef } from 'vue';
import type { MenuItem, InnerMenuItem, MenuPending, MenuAction, MenuSwitch, MenuRadio, MenuRadioOption, MenuParent } from '@/types/menu.js';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { isTouchUsing } from '@/utility/touch.js';
import { isFocusable } from '@/utility/focus.js';
import { getNodeOrNull } from '@/utility/get-dom-node-or-null.js';
import { Material } from '@/vune/material.js';
import type { MaterialName } from '@/vune/material.js';
import { createVuneComponent } from '@/vune/vue.js';
import { VueComponent } from '@/vune/vue.js';
import type { NativeMenuModel, NativeMenuRow } from './vune/MkMenu.types.js';
import NativeMkMenuView from './vune/MkMenu.vune';

const childrenCache = new WeakMap<MenuParent, MenuItem[]>();
</script>

<script lang="ts" setup>
const XChild = defineAsyncComponent(() => import('./MkMenu.child.vue'));
const NativeMkMenuHost = createVuneComponent(({ model }: { model: NativeMenuModel }) => NativeMkMenuView(model));
const $style = useCssModule();

const props = defineProps<{
	items: MenuItem[];
	asDrawer?: boolean;
	align?: 'center' | string;
	width?: number;
	maxHeight?: number;
	material?: MaterialName;
	animated?: boolean;
	debugDisablePredictionCone?: boolean;
	debugShowPredictionCone?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'close', actioned?: boolean): void;
	(ev: 'hide'): void;
}>();

const big = isTouchUsing;

const isNestingMenu = inject<boolean>('isNestingMenu', false);

const itemsEl = shallowRef<HTMLElement | null>(null);

const items2 = ref<InnerMenuItem[]>();

const child = useTemplateRef('child');

function setItemsEl(element: HTMLElement | null) {
	itemsEl.value = element;
}

function onMenuKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.preventDefault();
		close(false);
	} else if (event.key === 'ArrowUp' || event.key === 'k' || (event.key === 'Tab' && event.shiftKey)) {
		event.preventDefault();
		focusUp();
	} else if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'Tab') {
		event.preventDefault();
		focusDown();
	}
}

const childShowingItem = ref<MenuItem | null>();

let preferClick = isTouchUsing || props.asDrawer;

watch(() => props.items, () => {
	const items = [...props.items].filter(item => item !== undefined) as (NonNullable<MenuItem> | MenuPending)[];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if ('then' in item) { // if item is Promise
			items[i] = { type: 'pending' };
			item.then(actualItem => {
				if (items2.value?.[i]) items2.value[i] = actualItem;
			});
		}
	}

	items2.value = items as InnerMenuItem[];
}, {
	immediate: true,
});

const childMenu = ref<MenuItem[] | null>();
const childMenuKey = ref(0);
const childTarget = shallowRef<HTMLElement>();

function clearChildCloseTimer() {
	if (childCloseTimer === null) return;
	window.clearTimeout(childCloseTimer);
	childCloseTimer = null;
}

function closeChild() {
	clearChildCloseTimer();
	childMenu.value = null;
	childShowingItem.value = null;
}

function childActioned() {
	closeChild();
	close(true);
}

let childCloseTimer: null | number = null;

function onItemMouseEnter() {
	clearChildCloseTimer();
	childCloseTimer = window.setTimeout(() => {
		childCloseTimer = null;
		closeChild();
	}, 300);
}

function onItemMouseLeave() {
	clearChildCloseTimer();
}

async function showRadioOptions(item: MenuRadio, ev: MouseEvent | PointerEvent | KeyboardEvent) {
	// `currentTarget` is cleared by the browser once the event handler yields.
	// Capture the anchor before opening the async child menu so positioning does
	// not fall back to a nested icon/text node (or `null`).
	const anchorElement = (ev.currentTarget ?? ev.target) as HTMLElement;
	const children: MenuItem[] = item.options.map<MenuRadioOption>(def => {
		return {
			type: 'radioOption',
			text: def.label,
			action: () => {
				if (isRef(item.ref)) {
					item.ref.value = def.value;
				} else {
					// @ts-expect-error リアクティビティは保たれる
					item.ref = def.value;
				}
			},
			active: computed(() => {
				if (isRef(item.ref)) {
					return item.ref.value === def.value;
				} else {
					return item.ref === def.value;
				}
			}),
		};
	});

	if (props.asDrawer) {
		os.popupMenu(children, anchorElement).finally(() => {
			close(false);
		});
		emit('hide');
	} else {
		childTarget.value = anchorElement;
		childMenu.value = children;
		childMenuKey.value++;
		childShowingItem.value = item;
	}
}

async function showChildren(item: MenuParent, ev: MouseEvent | PointerEvent | KeyboardEvent) {
	// Keep the actual parent row. Native event `currentTarget` becomes `null`
	// after the async handler yields, which otherwise makes the submenu anchor
	// depend on whichever child element was under the pointer.
	const anchorElement = (ev.currentTarget ?? ev.target) as HTMLElement;
	ev.stopPropagation();

	const children: MenuItem[] = await (async () => {
		if (childrenCache.has(item)) {
			return childrenCache.get(item)!;
		} else {
			if (typeof item.children === 'function') {
				return Promise.resolve(item.children());
			} else {
				return item.children;
			}
		}
	})();

	childrenCache.set(item, children);

	if (props.asDrawer) {
		os.popupMenu(children, anchorElement).finally(() => {
			close(false);
		});
		emit('hide');
	} else {
		childTarget.value = anchorElement;
		// これでもリアクティビティは保たれる
		childMenu.value = children;
		childMenuKey.value++;
		childShowingItem.value = item;
	}
}

function clicked(fn: MenuAction, ev: PointerEvent, doClose = true) {
	fn(ev);

	if (!doClose) return;
	close(true);
}

function close(actioned = false) {
	disposeHandlers();
	nextTick(() => {
		closeChild();
		emit('close', actioned);
	});
}

function switchItem(item: MenuSwitch) {
	if (item.disabled !== undefined && (typeof item.disabled === 'boolean' ? item.disabled : item.disabled.value)) return;
	if (isRef(item.ref)) {
		item.ref.value = !item.ref.value;
	} else {
		// @ts-expect-error リアクティビティは保たれる
		item.ref = !item.ref;
	}
}

function focusUp() {
	if (disposed) return;
	if (!itemsEl.value?.contains(window.document.activeElement)) return;

	const focusableElements = Array.from(itemsEl.value.children).filter(isFocusable);
	const activeIndex = focusableElements.findIndex(el => el === window.document.activeElement);
	const targetIndex = (activeIndex !== -1 && activeIndex !== 0) ? (activeIndex - 1) : (focusableElements.length - 1);
	const targetElement = focusableElements.at(targetIndex) ?? itemsEl.value;

	targetElement.focus();
}

function focusDown() {
	if (disposed) return;
	if (!itemsEl.value?.contains(window.document.activeElement)) return;

	const focusableElements = Array.from(itemsEl.value.children).filter(isFocusable);
	const activeIndex = focusableElements.findIndex(el => el === window.document.activeElement);
	const targetIndex = (activeIndex !== -1 && activeIndex !== (focusableElements.length - 1)) ? (activeIndex + 1) : 0;
	const targetElement = focusableElements.at(targetIndex) ?? itemsEl.value;

	targetElement.focus();
}

const onGlobalFocusin = (ev: FocusEvent) => {
	if (disposed) return;
	if (itemsEl.value?.parentElement?.contains(getNodeOrNull(ev.target))) return;
	nextTick(() => {
		if (itemsEl.value != null && isFocusable(itemsEl.value)) {
			itemsEl.value.focus({ preventScroll: true });
			nextTick(() => focusDown());
		}
	});
};

const onGlobalMousedown = (ev: MouseEvent) => {
	if (disposed) return;
	if (childTarget.value?.contains(getNodeOrNull(ev.target))) return;
	if (child.value?.checkHit(ev)) return;
	closeChild();
};

const setupHandlers = () => {
	if (!isNestingMenu) {
		window.document.addEventListener('focusin', onGlobalFocusin, { passive: true });
	}
	window.document.addEventListener('mousedown', onGlobalMousedown, { passive: true });
};

let disposed = false;

const disposeHandlers = () => {
	disposed = true;
	if (!isNestingMenu) {
		window.document.removeEventListener('focusin', onGlobalFocusin);
	}
	window.document.removeEventListener('mousedown', onGlobalMousedown);
};

onMounted(() => {
	setupHandlers();

	if (!isNestingMenu) {
		nextTick(() => itemsEl.value?.focus({ preventScroll: true }));
	}
});

onBeforeUnmount(() => {
	clearChildCloseTimer();
	disposeHandlers();
});

const guard = reactive({
	enabled: false,
	top: 0,
	cursorSideX: 0,
	cursorSideY: 0,
	childSideTopY: 0,
	childSideBottomY: 0,
	direction: 'toRight',
});

const guardPolygon = computed(() =>
	guard.enabled
		? guard.direction === 'toRight'
			? `polygon(${guard.cursorSideX}px ${guard.cursorSideY}px, 101% ${guard.childSideTopY}px, 101% ${guard.childSideBottomY}px)` // ぴったり端に100%で覆ってもなぜか端でカーソルのイベントが後ろに貫通するので1%だけ伸ばす
			: `polygon(0% ${guard.childSideTopY}px, 0% ${guard.childSideBottomY}px, ${guard.cursorSideX}px ${guard.cursorSideY}px)`
		: 'polygon(0 0, 0 0, 0 0)',
);

function parentMouseMove(ev: MouseEvent) {
	if (props.debugDisablePredictionCone) return;
	if (isTouchUsing) return;
	if (child.value == null || child.value.rootElement == null) return;

	ev.stopPropagation();

	const itemBounding = (ev.currentTarget as HTMLElement).getBoundingClientRect();
	const rootBounding = itemsEl.value!.getBoundingClientRect();
	const childBounding = child.value.rootElement.getBoundingClientRect();
	const isChildRight = childBounding.left > rootBounding.left;

	const CURSOR_SIDE_X_PADDING = 3; // (px)
	const CHILD_SIDE_Y_PADDING_BASE = 70; // (px)
	const CHILD_SIDE_Y_PADDING_EXTEND = 30; // (px)
	const SCALE_FACTOR_COMPUTE_DISTANCE = 300; // コーンの広さが最大になる距離(px)
	const localMouseX = ev.clientX - itemBounding.left;
	const localMouseY = ev.clientY - rootBounding.top;
	const scaleFactor = isChildRight ? Math.min((itemBounding.width - localMouseX), SCALE_FACTOR_COMPUTE_DISTANCE) / SCALE_FACTOR_COMPUTE_DISTANCE : Math.min(localMouseX, SCALE_FACTOR_COMPUTE_DISTANCE) / SCALE_FACTOR_COMPUTE_DISTANCE;
	const cursorSideXPadding = isChildRight ? CURSOR_SIDE_X_PADDING : -CURSOR_SIDE_X_PADDING;
	const childSideYPadding = CHILD_SIDE_Y_PADDING_BASE + (CHILD_SIDE_Y_PADDING_EXTEND * scaleFactor);

	guard.enabled = true;
	guard.top = itemsEl.value!.scrollTop;
	guard.cursorSideX = localMouseX - cursorSideXPadding;
	guard.cursorSideY = localMouseY;
	guard.childSideTopY = (childBounding.top - rootBounding.top) - childSideYPadding;
	guard.childSideBottomY = (childBounding.bottom - rootBounding.top) + childSideYPadding;
	guard.direction = isChildRight ? 'toRight' : 'toLeft';
}

function onMouseLeave() {
	guard.enabled = false;
}

function onMouseMove() {
	guard.enabled = false;
}

function guardMouseMove(ev: MouseEvent) {
	ev.stopPropagation();
}

const materials: Record<MaterialName, Material> = {
	ultraThin: Material.ultraThin,
	thin: Material.thin,
	regular: Material.regular,
	thick: Material.thick,
	ultraThick: Material.ultraThick,
	bar: Material.bar,
};

function menuText(value: unknown): string {
	return String(unref(value as string) ?? '');
}

function nativeRow(item: InnerMenuItem, index: number): NativeMenuRow {
	const key = `${index}:${item.type ?? 'button'}`;
	const base = {
		key,
		text: 'text' in item ? menuText(item.text) : undefined,
		caption: 'caption' in item ? menuText(item.caption) : undefined,
		icon: 'icon' in item ? item.icon : undefined,
		iconClass: $style.icon,
		contentClass: $style.item_content,
		textClass: [$style.item_content_text],
		titleClass: $style.item_content_text_title,
		captionClass: $style.item_content_text_caption,
		caretClass: $style.caret,
		indicatorClass: $style.indicator,
		switchClass: [$style.switchButton, item.type === 'switch' && item.icon ? $style.caret : ''],
		onLeave: onItemMouseLeave,
	} satisfies Partial<NativeMenuRow>;

	if (item.type === 'divider') return { key, kind: 'divider', className: [$style.divider] };
	if (item.type === 'label') return { ...base, kind: 'label', className: [$style.label] };
	if (item.type === 'pending') return { key, kind: 'pending', className: [$style.pending, $style.item] };
	if (item.type === 'component') {
		return {
			key,
			kind: 'component',
			content: VueComponent(item.component, unref(item.props) ?? {}),
		};
	}

	const hover = { onHover: onItemMouseEnter, onLeave: onItemMouseLeave };
	if (item.type === 'link') {
		return {
			...base,
			...hover,
			kind: 'link',
			href: item.to,
			className: ['_button', $style.item],
			indicate: item.indicate,
			leading: item.avatar ? VueComponent(MkAvatar, { user: item.avatar, class: 'mk-vune-menu__avatar' }) : undefined,
			onActivate: () => close(true),
		};
	}
	if (item.type === 'a') {
		return {
			...base,
			...hover,
			kind: 'external',
			href: item.href,
			target: item.target,
			download: item.download,
			className: ['_button', $style.item],
			indicate: item.indicate,
			onActivate: () => close(true),
		};
	}
	if (item.type === 'user') {
		return {
			...base,
			...hover,
			kind: 'button',
			text: '',
			active: item.active,
			className: ['_button', $style.item, item.active ? $style.active : ''],
			leading: VueComponent(MkAvatar, { user: item.user, class: 'mk-vune-menu__avatar' }),
			content: VueComponent(MkUserName, { user: item.user }),
			indicate: item.indicate,
			onActivate: event => item.active ? close(false) : clicked(item.action, event),
		};
	}
	if (item.type === 'switch') {
		const disabled = unref(item.disabled) ?? false;
		return {
			...base,
			...hover,
			kind: 'switch',
			className: ['_button', $style.item],
			disabled,
			checked: unref(item.ref),
			onActivate: () => switchItem(item),
		};
	}
	if (item.type === 'radio' || item.type === 'parent') {
		const show = item.type === 'radio' ? showRadioOptions : showChildren;
		return {
			...base,
			kind: 'parent',
			active: childShowingItem.value === item,
			className: ['_button', $style.item, $style.parent, childShowingItem.value === item ? $style.active : ''],
			disabled: item.type === 'radio' ? (unref(item.disabled) ?? false) : false,
			onHover: event => { if (!preferClick) void show(item as never, event); },
			onMove: parentMouseMove,
			// Opening a parent by click is important on pointer devices too: the
			// native menu row is a real button, and relying on hover alone makes
			// the submenu unreachable for trackpads, keyboard users, and touch
			// emulation. `showChildren`/`showRadioOptions` still route drawers to
			// the regular popup path.
			onActivate: event => { void show(item as never, event); },
		};
	}
	if (item.type === 'radioOption') {
		const active = unref(item.active) ?? false;
		return {
			...base,
			...hover,
			kind: 'radio',
			className: ['_button', $style.item, $style.radio, active ? $style.active : ''],
			checked: active,
			radioIconClass: [$style.radioIcon, active ? $style.radioChecked : ''],
			onActivate: event => { if (!active) clicked(item.action, event, false); },
		};
	}

	const active = unref(item.active) ?? false;
	return {
		...base,
		...hover,
		kind: 'button',
		danger: item.danger,
		className: ['_button', $style.item, item.danger ? $style.danger : '', active ? $style.active : ''],
		active,
		indicate: item.indicate,
		leading: item.avatar ? VueComponent(MkAvatar, { user: item.avatar, class: 'mk-vune-menu__avatar' }) : undefined,
		onActivate: event => active ? close(false) : clicked(item.action, event),
	};
}

const nativeModel = computed<NativeMenuModel>(() => ({
	rows: (items2.value ?? []).map(nativeRow),
	material: materials[props.material ?? 'regular'],
	animated: props.animated ?? true,
	menuClass: $style.menu,
	surfaceClass: $style.surface,
	itemClass: [$style.none, $style.item].join(' '),
	noneLabel: i18n.ts.none,
	width: props.width && !props.asDrawer ? props.width : undefined,
	maxHeight: props.maxHeight,
	asDrawer: Boolean(props.asDrawer),
	big: Boolean(big),
	center: props.align === 'center',
	guardClass: [$style.guard, props.debugShowPredictionCone ? $style.showGuard : ''],
	guardClipPath: guardPolygon.value,
	guardTop: guard.top,
	onItemsRef: setItemsEl,
	onKeydown: onMenuKeydown,
	onMouseMove,
	onMouseLeave,
	onGuardMouseMove: guardMouseMove,
}));
</script>

<style lang="scss" module>
.root {
	// Submenus are positioned relative to their owning menu. The native Vune
	// surface no longer provides the old Vue menu's containing block, so keep
	// the menu root as the explicit anchor for nested menus.
	position: relative;

	&.center {
		> .menu {
			> .item {
				text-align: center;
			}
		}
	}

	&:not(.asDrawer):not(.widthSpecified) {
		> .menu {
			max-width: 400px;
		}
	}

	&.big:not(.asDrawer) {
		> .menu {
			min-width: 230px;

			> .item {
				padding: 6px 20px;
				font-size: 0.95em;
				line-height: 24px;
			}
		}
	}

	&.asDrawer {
		max-width: 600px;
		margin: auto;

		> .menu {
			padding: 12px 0 max(env(safe-area-inset-bottom, 0px), 12px) 0;
			width: 100%;
			border-radius: 24px;
			corner-shape: round;
			border-bottom-right-radius: 0;
			border-bottom-left-radius: 0;

			> .item {
				font-size: 1em;
				padding: 12px 24px;

				&::before {
					width: calc(100% - 24px);
					border-radius: 12px;
					corner-shape: round;
				}

				> .icon {
					margin-right: 14px;
					width: 24px;
				}
			}

			> .divider {
				margin: 12px 0;
			}
		}
	}
}

.menu {
	padding: 8px 0;
	box-sizing: border-box;
	max-width: 100vw;
	min-width: 200px;
	corner-shape: round;
	overflow: auto;
	overscroll-behavior: contain;

	&:focus-visible {
		outline: none;
	}
}

.surface {
	max-width: 100vw;
	overflow: hidden;
}

.item {
	display: flex;
	align-items: center;
	position: relative;
	padding: 5px 16px;
	width: 100%;
	box-sizing: border-box;
	white-space: nowrap;
	font-size: 0.9em;
	line-height: 20px;
	text-align: left;
	overflow: hidden;
	text-overflow: ellipsis;
	text-decoration: none !important;
	color: var(--menuFg, var(--MI_THEME-fg));

	&::before {
		content: "";
		display: block;
		position: absolute;
		z-index: -1;
		top: 0;
		left: 0;
		right: 0;
		margin: auto;
		width: calc(100% - 16px);
		height: 100%;
		border-radius: 6px;
		corner-shape: round;
	}

	&:focus-visible {
		outline: none;

		&:not(:hover):not(:active)::before {
			outline: var(--MI_THEME-focus) solid 2px;
			outline-offset: -2px;
		}
	}

	&:not(:disabled) {
		&:hover,
		&:focus-visible:active,
		&:focus-visible.active {
			color: var(--menuHoverFg, var(--MI_THEME-accent));
			position: relative;
			z-index: 10; // guardより上にする

			&::before {
				background-color: var(--menuHoverBg, var(--MI_THEME-accentedBg));
			}
		}

		&:not(:focus-visible):active,
		&:not(:focus-visible).active {
			color: var(--menuActiveFg, var(--MI_THEME-fgOnAccent));

			&::before {
				background-color: var(--menuActiveBg, var(--MI_THEME-accent));
			}
		}
	}

	&:disabled {
		cursor: not-allowed;
	}

	&.danger {
		--menuFg: var(--MI_THEME-error);
		--menuHoverFg: #fff;
		--menuHoverBg: var(--MI_THEME-error);
		--menuActiveFg: #fff;
		--menuActiveBg: hsl(from var(--MI_THEME-error) h s calc(l - 10));
	}

	&.radio {
		--menuActiveFg: var(--MI_THEME-accent);
		--menuActiveBg: var(--MI_THEME-accentedBg);
	}

	&.parent {
		--menuActiveFg: var(--MI_THEME-accent);
		--menuActiveBg: var(--MI_THEME-accentedBg);
	}

	&.pending {
		pointer-events: none;
		opacity: 0.7;
	}

	&.none {
		pointer-events: none;
		opacity: 0.7;
	}
}

.item_content {
	width: 100%;
	max-width: 100vw;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	text-overflow: ellipsis;
}

.item_content_text {
	max-width: calc(100vw - 4rem);
}

.item_content_text_title {
	text-overflow: ellipsis;
	overflow: hidden;
}

.item_content_text_caption {
	text-wrap: auto;
	font-size: 85%;
	opacity: 0.7;
}

.switchButton {
	margin-left: -2px;
	--height: 1.35em;
}

.switchText {
	margin-left: 8px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.icon {
	margin-right: 8px;
	line-height: 1;
}

.caret {
	margin-left: auto;
}

.avatar {
	margin-right: 5px;
	width: 20px;
	height: 20px;
}

.indicator {
	display: flex;
	align-items: center;
	color: var(--MI_THEME-indicator);
	font-size: 12px;
}

.label {
	position: relative;
	padding: 6px 16px;
	box-sizing: border-box;
	white-space: nowrap;
	font-size: 0.7em;
	text-align: left;
	overflow: hidden;
	text-overflow: ellipsis;
	opacity: 0.7;
	pointer-events: none;
}

.divider {
	margin: 8px 0;
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.radioIcon {
	display: inline-block;
	position: relative;
	width: 1em;
	height: 1em;
	vertical-align: -0.125em;
	border-radius: 50%;
	corner-shape: round;
	border: solid 2px var(--MI_THEME-divider);
	background-color: var(--MI_THEME-panel);

	&.radioChecked {
		border-color: var(--MI_THEME-accent);

		&::after {
			content: "";
			display: block;
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 50%;
			height: 50%;
			border-radius: 50%;
			corner-shape: round;
			background-color: var(--MI_THEME-accent);
		}
	}
}

.guard {
	position: absolute;
	left: 0;
	width: 100%;
	height: 100%;
	cursor: pointer;

	&.showGuard {
		background: #0f04;

		&:hover {
			background: #f004;
		}
	}
}
</style>
