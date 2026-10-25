<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:name="transitionName"
	:enterActiveClass="normalizeClass({
		[$style.transition_modalDrawer_enterActive]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_enterActive]: transitionName === 'modal-popup',
		[$style.transition_modalFloating_enterActive]: transitionName === 'modal-floating',
		[$style.transition_modal_enterActive]: transitionName === 'modal',
		[$style.transition_send_enterActive]: transitionName === 'send',
	})"
	:leaveActiveClass="normalizeClass({
		[$style.transition_modalDrawer_leaveActive]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_leaveActive]: transitionName === 'modal-popup',
		[$style.transition_modalFloating_leaveActive]: transitionName === 'modal-floating',
		[$style.transition_modal_leaveActive]: transitionName === 'modal',
		[$style.transition_send_leaveActive]: transitionName === 'send',
	})"
	:enterFromClass="normalizeClass({
		[$style.transition_modalDrawer_enterFrom]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_enterFrom]: transitionName === 'modal-popup',
		[$style.transition_modalFloating_enterFrom]: transitionName === 'modal-floating',
		[$style.transition_modal_enterFrom]: transitionName === 'modal',
		[$style.transition_send_enterFrom]: transitionName === 'send',
	})"
	:leaveToClass="normalizeClass({
		[$style.transition_modalDrawer_leaveTo]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_leaveTo]: transitionName === 'modal-popup',
		[$style.transition_modalFloating_leaveTo]: transitionName === 'modal-floating',
		[$style.transition_modal_leaveTo]: transitionName === 'modal',
		[$style.transition_send_leaveTo]: transitionName === 'send',
	})"
	:duration="transitionDuration" appear @afterLeave="onClosed" @enter="emit('opening')" @afterEnter="onOpened"
>
	<div v-show="manualShowing != null ? manualShowing : showing" ref="modalRootEl" v-hotkey.global="keymap" :class="[$style.root, { [$style.drawer]: type === 'drawer', [$style.dialog]: type === 'dialog', [$style.popup]: type === 'popup', [$style.floating]: type === 'floating' }]" :style="{ zIndex, pointerEvents: (manualShowing != null ? manualShowing : showing) ? 'auto' : 'none', '--transformOrigin': transformOrigin }">
		<MkProgressiveBlur v-if="useBackdropBlur" variant="viewport" :origin="backdropOrigin" :class="$style.backdropBlur" :style="{ zIndex }"/>
		<MkFloatingBackdrop v-if="type === 'floating' && floatingHole" :hole="floatingHole" :blur="prefer.s.useProgressiveBlurForModal" :class="$style.backdropBlur" :style="{ zIndex }"/>
		<div data-testid="bg" :data-test-is-transparent="isEnableBgTransparent" class="_modalBg" :class="[$style.bg, { [$style.bgTransparent]: isEnableBgTransparent, [$style.bgProgressive]: useBackdropBlur }]" :style="{ zIndex, '--backdropOrigin': backdropOrigin }" @click="onBgClick" @mousedown="onBgClick" @contextmenu.prevent.stop="() => {}"></div>
		<div ref="content" :class="[$style.content, { [$style.fixed]: fixed }]" :style="{ zIndex }" @click.self="onBgClick">
			<slot :max-height="maxHeight" :type="type"></slot>
		</div>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { nextTick, normalizeClass, onMounted, onUnmounted, provide, watch, ref, useTemplateRef, computed } from 'vue';
import type { Keymap } from '@/utility/hotkey.js';
import * as os from '@/os.js';
import { isTouchUsing } from '@/utility/touch.js';
import { deviceKind } from '@/utility/device-kind.js';
import { focusTrap } from '@/utility/focus-trap.js';
import { focusParent } from '@/utility/focus.js';
import { prefer } from '@/preferences.js';
import MkProgressiveBlur from '@/components/MkProgressiveBlur.vue';
import MkFloatingBackdrop from '@/components/MkFloatingBackdrop.vue';
import type { FloatingHole } from '@/components/MkFloatingBackdrop.vue';
import { DI } from '@/di.js';

function getFixedContainer(el: Element | null): Element | null {
	if (el == null || el.tagName === 'BODY') return null;
	const position = window.getComputedStyle(el).getPropertyValue('position');
	if (position === 'fixed') {
		return el;
	} else {
		return getFixedContainer(el.parentElement);
	}
}

type ModalTypes = 'popup' | 'dialog' | 'drawer' | 'floating';

const props = withDefaults(defineProps<{
	manualShowing?: boolean | null;
	anchor?: { x: string; y: string; };
	anchorElement?: HTMLElement | null;
	preferType?: ModalTypes | 'auto';
	zPriority?: 'low' | 'middle' | 'high';
	noOverlap?: boolean;
	transparentBg?: boolean;
	backdropOrigin?: string;
	/** Skip the backdrop ProgressiveBlur, e.g. when the content owns its own edge blur. */
	noBgBlur?: boolean;
	hasInteractionWithOtherFocusTrappedEls?: boolean;
	returnFocusTo?: HTMLElement | null;
}>(), {
	manualShowing: null,
	anchorElement: null,
	anchor: () => ({ x: 'center', y: 'bottom' }),
	preferType: 'auto',
	zPriority: 'low',
	noOverlap: true,
	transparentBg: false,
	backdropOrigin: undefined,
	noBgBlur: false,
	hasInteractionWithOtherFocusTrappedEls: false,
	returnFocusTo: null,
});

const emit = defineEmits<{
	(ev: 'opening'): void;
	(ev: 'opened'): void;
	(ev: 'click'): void;
	(ev: 'esc'): void;
	(ev: 'close'): void; // TODO: (refactor) closing に改名する
	(ev: 'closed'): void;
}>();

provide(DI.inModal, true);

const maxHeight = ref<number>();
const fixed = ref(false);
const transformOrigin = ref('center');
const showing = ref(true);
const modalRootEl = useTemplateRef('modalRootEl');
const content = useTemplateRef('content');
const zIndex = os.claimZIndex(props.zPriority);
const useSendAnime = ref(false);
const type = computed<ModalTypes>(() => {
	if (props.preferType === 'auto') {
		// Floating needs the pressed element to lift; without one it falls back to a drawer.
		if (prefer.s.menuStyle === 'floating') {
			return props.anchorElement != null ? 'floating' : 'drawer';
		}
		if ((prefer.s.menuStyle === 'drawer') || (prefer.s.menuStyle === 'auto' && isTouchUsing && deviceKind === 'smartphone')) {
			return 'drawer';
		} else {
			return props.anchorElement != null ? 'popup' : 'dialog';
		}
	} else {
		return props.preferType!;
	}
});
// A caller requesting a transparent backdrop must not gain a viewport blur
// merely because its responsive presentation switches to a dialog or drawer.
// Floating draws its own dim and blur around the pressed element instead.
const isEnableBgTransparent = computed(() => props.transparentBg || type.value === 'floating');
// Modal backdrops blur via ProgressiveBlur, matching menus and the navbar.
const useBackdropBlur = computed(() => prefer.s.useProgressiveBlurForModal && !isEnableBgTransparent.value && !props.noBgBlur);
const floatingHole = ref<FloatingHole | null>(null);
const backdropOrigin = computed(() => props.backdropOrigin ?? (type.value === 'drawer' ? '50% 100%' : '50% 50%'));
const transitionName = computed((() =>
	prefer.s.animation
		? useSendAnime.value
			? 'send'
			: type.value === 'drawer'
				? 'modal-drawer'
				: type.value === 'popup'
					? 'modal-popup'
					: type.value === 'floating'
						? 'modal-floating'
						: 'modal'
		: ''
));
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reducedMotionQuery.matches);
const syncReducedMotion = () => { reducedMotion.value = reducedMotionQuery.matches; };
reducedMotionQuery.addEventListener('change', syncReducedMotion);
onUnmounted(() => reducedMotionQuery.removeEventListener('change', syncReducedMotion));

// Vue must release focus and remove the backdrop when the CSS exit actually ends.
const transitionDuration = computed(() => {
	if (!prefer.s.animation || reducedMotion.value) return 0;
	if (transitionName.value === 'send') return { enter: 160, leave: 160 };
	if (transitionName.value === 'modal-drawer') return { enter: 280, leave: 180 };
	if (transitionName.value === 'modal-popup') return { enter: 160, leave: 120 };
	if (transitionName.value === 'modal-floating') return { enter: 440, leave: 200 };
	return { enter: 220, leave: 160 };
});

let releaseFocusTrap: (() => void) | null = null;
let contentClicking = false;

function close(opts: { useSendAnimation?: boolean } = {}) {
	if (opts.useSendAnimation) {
		useSendAnime.value = true;
	}

	if (props.anchorElement) props.anchorElement.style.pointerEvents = 'auto';
	showing.value = false;
	emit('close');
}

function onBgClick() {
	if (contentClicking) return;
	emit('click');
}

if (type.value === 'drawer') {
	maxHeight.value = window.innerHeight / 1.5;
}

const keymap = {
	'esc': {
		allowRepeat: true,
		callback: () => emit('esc'),
	},
} as const satisfies Keymap;

const MARGIN = 16;
const SCROLLBAR_THICKNESS = 16;

const FLOATING_GAP = 14;
const FLOATING_MIN_SPACE = 120;

// Places the menu beside the pressed element, never over it: below when it
// fits, above when only that fits, else on the roomier side with a capped height.
// Only an element taller than the screen leaves no side, and then the menu docks at the bottom.
const alignFloating = () => {
	const anchorEl = props.anchorElement!;
	const el = content.value!;
	const rect = anchorEl.getBoundingClientRect();
	floatingHole.value = {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
		radius: parseFloat(window.getComputedStyle(anchorEl).borderTopLeftRadius) || 0,
	};

	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = el.offsetWidth;
	const height = el.offsetHeight;
	const below = vh - MARGIN - (rect.bottom + FLOATING_GAP);
	const above = rect.top - FLOATING_GAP - MARGIN;

	let top: number;
	let originY: string;
	if (Math.max(below, above) < FLOATING_MIN_SPACE) {
		maxHeight.value = vh / 2;
		top = vh - MARGIN - height;
		originY = '100%';
	} else if (height <= below || (height > above && below >= above)) {
		maxHeight.value = below;
		top = rect.bottom + FLOATING_GAP;
		originY = '0%';
	} else {
		maxHeight.value = above;
		top = rect.top - FLOATING_GAP - height;
		originY = '100%';
	}

	// Hug the element's nearer edge so the menu reads as coming out of it.
	const centerX = rect.left + rect.width / 2;
	let left = centerX < vw / 2 ? rect.left : rect.right - width;
	left = Math.min(Math.max(left, MARGIN), vw - MARGIN - width);

	transformOrigin.value = `${Math.min(Math.max(centerX - left, 0), width)}px ${originY}`;
	el.style.left = left + 'px';
	el.style.top = top + 'px';
};

const align = () => {
	if (props.anchorElement == null) return;
	if (type.value === 'drawer') return;
	if (type.value === 'floating') {
		if (content.value != null) alignFloating();
		return;
	}
	if (type.value === 'dialog') return;

	if (content.value == null) return;

	const anchorRect = props.anchorElement.getBoundingClientRect();

	const width = content.value!.offsetWidth;
	const height = content.value!.offsetHeight;

	let left = 0;
	let top = 0;

	const x = anchorRect.left + (fixed.value ? 0 : window.scrollX);
	const y = anchorRect.top + (fixed.value ? 0 : window.scrollY);

	if (props.anchor.x === 'center') {
		left = x + (props.anchorElement.offsetWidth / 2) - (width / 2);
	} else if (props.anchor.x === 'left') {
		// TODO
	} else if (props.anchor.x === 'right') {
		left = x + props.anchorElement.offsetWidth;
	}

	if (props.anchor.y === 'center') {
		top = (y - (height / 2));
	} else if (props.anchor.y === 'top') {
		// TODO
	} else if (props.anchor.y === 'bottom') {
		top = y + props.anchorElement.offsetHeight;
	}

	if (fixed.value) {
		// 画面から横にはみ出る場合
		if (left + width > (window.innerWidth - SCROLLBAR_THICKNESS)) {
			left = (window.innerWidth - SCROLLBAR_THICKNESS) - width;
		}

		const underSpace = ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN) - top;
		const upperSpace = (anchorRect.top - MARGIN);

		// 画面から縦にはみ出る場合
		if (top + height > ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN)) {
			if (props.noOverlap && props.anchor.x === 'center') {
				if (underSpace >= (upperSpace / 3)) {
					maxHeight.value = underSpace;
				} else {
					maxHeight.value = upperSpace;
					top = (upperSpace + MARGIN) - height;
				}
			} else {
				top = ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN) - height;
			}
		} else {
			maxHeight.value = underSpace;
		}
	} else {
		// 画面から横にはみ出る場合
		if (left + width - window.scrollX > (window.innerWidth - SCROLLBAR_THICKNESS)) {
			left = (window.innerWidth - SCROLLBAR_THICKNESS) - width + window.scrollX - 1;
		}

		const underSpace = ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN) - (top - window.scrollY);
		const upperSpace = (anchorRect.top - MARGIN);

		// 画面から縦にはみ出る場合
		if (top + height - window.scrollY > ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN)) {
			if (props.noOverlap && props.anchor.x === 'center') {
				if (underSpace >= (upperSpace / 3)) {
					maxHeight.value = underSpace;
				} else {
					maxHeight.value = upperSpace;
					top = window.scrollY + ((upperSpace + MARGIN) - height);
				}
			} else {
				top = ((window.innerHeight - SCROLLBAR_THICKNESS) - MARGIN) - height + window.scrollY - 1;
			}
		} else {
			maxHeight.value = underSpace;
		}
	}

	if (top < 0) {
		top = MARGIN;
	}

	if (left < 0) {
		left = 0;
	}

	let transformOriginX = 'center';
	let transformOriginY = 'center';

	if (top >= anchorRect.top + props.anchorElement.offsetHeight + (fixed.value ? 0 : window.scrollY)) {
		transformOriginY = 'top';
	} else if ((top + height) <= anchorRect.top + (fixed.value ? 0 : window.scrollY)) {
		transformOriginY = 'bottom';
	}

	if (left >= anchorRect.left + props.anchorElement.offsetWidth + (fixed.value ? 0 : window.scrollX)) {
		transformOriginX = 'left';
	} else if ((left + width) <= anchorRect.left + (fixed.value ? 0 : window.scrollX)) {
		transformOriginX = 'right';
	}

	transformOrigin.value = `${transformOriginX} ${transformOriginY}`;

	content.value.style.left = left + 'px';
	content.value.style.top = top + 'px';
};

const onOpened = () => {
	emit('opened');

	// contentの子要素にアクセスするためレンダリングの完了を待つ必要がある（nextTickが必要）
	nextTick(() => {
		// NOTE: Chromatic テストの際に undefined になる場合がある
		if (content.value == null) return;

		// モーダルコンテンツにマウスボタンが押され、コンテンツ外でマウスボタンが離されたときにモーダルバックグラウンドクリックと判定させないためにマウスイベントを監視しフラグ管理する
		const el = content.value.children[0];
		if (el == null) return;
		el.addEventListener('mousedown', ev => {
			contentClicking = true;
			window.addEventListener('mouseup', ev => {
				// click イベントより先に mouseup イベントが発生するかもしれないのでちょっと待つ
				window.setTimeout(() => {
					contentClicking = false;
				}, 100);
			}, { passive: true, once: true });
		}, { passive: true });
	});
};

const onClosed = () => {
	emit('closed');
};

const alignObserver = new ResizeObserver((entries, observer) => {
	align();
});

// Window, rotation and on-screen keyboard changes all move the pressed element;
// coalesce them into one realign per frame so the hole and menu follow together.
let realignFrame: number | null = null;
function scheduleAlign() {
	if (realignFrame != null) return;
	realignFrame = window.requestAnimationFrame(() => {
		realignFrame = null;
		align();
	});
}

onMounted(() => {
	watch(() => props.anchorElement, async () => {
		if (props.anchorElement) {
			props.anchorElement.style.pointerEvents = 'none';
		}
		fixed.value = (type.value === 'drawer') || (type.value === 'floating') || (getFixedContainer(props.anchorElement) != null);

		await nextTick();

		align();
	}, { immediate: true });

	watch([showing, () => props.manualShowing], ([showing, manualShowing]) => {
		if (manualShowing === true || (manualShowing == null && showing === true)) {
			if (modalRootEl.value != null) {
				const { release } = focusTrap(modalRootEl.value, props.hasInteractionWithOtherFocusTrappedEls);

				releaseFocusTrap = release;
				modalRootEl.value.focus();
			}
		} else {
			releaseFocusTrap?.();
			focusParent(props.returnFocusTo ?? props.anchorElement, true, false);
		}
	}, { immediate: true });

	nextTick(() => {
		alignObserver.observe(content.value!);
		if (type.value === 'floating' && props.anchorElement != null) alignObserver.observe(props.anchorElement);
	});

	window.addEventListener('resize', scheduleAlign, { passive: true });
	window.visualViewport?.addEventListener('resize', scheduleAlign, { passive: true });
});

onUnmounted(() => {
	alignObserver.disconnect();
	window.removeEventListener('resize', scheduleAlign);
	window.visualViewport?.removeEventListener('resize', scheduleAlign);
	if (realignFrame != null) window.cancelAnimationFrame(realignFrame);
});

defineExpose({
	close,
});
</script>

<style lang="scss" module>
// The backdrop and any panel that hosts its own MkProgressiveBlur fade through
// --MI-fade, never opacity: an opacity < 1 ancestor would become the blur's
// backdrop root, so the blur would show only the panel until the fade ended.
$blurHost: ':has(> * > [data-progressive-blur])';

@mixin fading($fade, $content, $transform: null) {
	> .bg {
		transition: opacity $fade !important;
	}

	> .backdropBlur {
		transition: --MI-fade $fade !important;
	}

	> .content {
		transform-origin: var(--transformOrigin);
		@if $content {
			transition: opacity $content, $transform !important;

			&#{$blurHost} {
				transition: --MI-fade $content, $transform !important;

				> * > :not([data-progressive-blur]) {
					opacity: var(--MI-fade);
				}
			}
		} @else {
			transition: $transform !important;
		}
	}
}

@mixin faded($transform, $fadeContent: true) {
	> .bg {
		opacity: 0;
	}

	> .backdropBlur {
		--MI-fade: 0;
	}

	> .content {
		pointer-events: none;
		transform: $transform;
		@if $fadeContent {
			--MI-fade: 0;

			&:not(#{$blurHost}) {
				opacity: 0;
			}
		}
	}
}

.transition_send_enterActive,
.transition_send_leaveActive {
	@include fading(160ms var(--MI-easeOut), 160ms var(--MI-easeOut), transform 160ms var(--MI-easeOut));
}
.transition_send_enterFrom,
.transition_send_leaveTo {
	@include faded(translateY(-12px));
}

.transition_modal_enterActive {
	@include fading(220ms var(--MI-easeOut), 160ms var(--MI-easeOut), transform 220ms var(--MI-easeOut));
}
.transition_modal_leaveActive {
	@include fading(160ms var(--MI-easeOut), 160ms var(--MI-easeOut), transform 160ms var(--MI-easeOut));
}
.transition_modal_enterFrom,
.transition_modal_leaveTo {
	@include faded(scale(0.98) translateY(4px));
}

.transition_modalPopup_enterActive {
	@include fading(160ms var(--MI-easeOut), 120ms var(--MI-easeOut), transform 160ms var(--MI-easeOut));
}
.transition_modalPopup_leaveActive {
	@include fading(120ms var(--MI-easeOut), 120ms var(--MI-easeOut), transform 120ms var(--MI-easeOut));
}
.transition_modalPopup_enterFrom,
.transition_modalPopup_leaveTo {
	@include faded(scale(0.98));
}

// Grows out of the pressed element on a slightly underdamped spring
// (stiffness 400, damping 30), sampled into linear() so it stays on the compositor.
.transition_modalFloating_enterActive {
	@include fading(240ms var(--MI-easeOut), 160ms var(--MI-easeOut), transform 440ms linear(0, 0.0421, 0.1432, 0.2733, 0.4112, 0.5433, 0.6614, 0.7615, 0.8427, 0.9056, 0.9523, 0.9851, 1.0068, 1.0197, 1.0263, 1.0284, 1.0274, 1.0247, 1.0211, 1.0171, 1.0134, 1.01, 1.0071, 1.0047, 1.0029, 1.0015, 1.0005, 0.9999, 1));
}
.transition_modalFloating_leaveActive {
	@include fading(200ms var(--MI-easeOut), 160ms var(--MI-easeOut), transform 200ms var(--MI-motion-ease-exit, cubic-bezier(.4,0,1,1)));
}
.transition_modalFloating_enterFrom {
	@include faded(scale(0.6));
}
.transition_modalFloating_leaveTo {
	@include faded(scale(0.9));
}

.transition_modalDrawer_enterActive {
	@include fading(280ms var(--MI-easeOut), null, transform 280ms cubic-bezier(0.32, 0.72, 0, 1));
}
.transition_modalDrawer_leaveActive {
	@include fading(180ms var(--MI-easeOut), null, transform 180ms cubic-bezier(.4,0,1,1));
}
.transition_modalDrawer_enterFrom,
.transition_modalDrawer_leaveTo {
	@include faded(translateY(100%), false);
}

.root {
	&.dialog {
		> .content {
			position: fixed;
			top: 0;
			bottom: 0;
			left: 0;
			right: 0;
			margin: auto;
			padding: 32px;
			padding-top: max(32px, calc(env(safe-area-inset-top, 0px) + 16px));
			padding-bottom: max(32px, calc(env(safe-area-inset-bottom, 0px) + 16px));
			display: flex;
			overflow: auto;

			@media (max-width: 500px) {
				padding: 16px;
				padding-top: max(16px, calc(env(safe-area-inset-top, 0px) + 16px));
				padding-bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px));
			}
		}
	}

	&.popup {
		> .content {
			position: absolute;

			&.fixed {
				position: fixed;
			}
		}
	}

	&.floating {
		position: fixed;
		inset: 0;
		// The hole is fixed to where the element was pressed; the page must not move under it.
		// Only on the backdrop: touch-action intersects down the tree, so the menu could not scroll.
		> .bg {
			touch-action: none;
		}

		> .content {
			position: fixed;
		}
	}

	&.drawer {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: clip;

		> .content {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			margin: auto;
		}
	}
}

.bg {
	// The progressive blur is the whole backdrop: no dim floor over the page.
	&.bgProgressive {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	&.bgTransparent {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
}
</style>
