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
		[$style.transition_modal_enterActive]: transitionName === 'modal',
		[$style.transition_send_enterActive]: transitionName === 'send',
	})"
	:leaveActiveClass="normalizeClass({
		[$style.transition_modalDrawer_leaveActive]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_leaveActive]: transitionName === 'modal-popup',
		[$style.transition_modal_leaveActive]: transitionName === 'modal',
		[$style.transition_send_leaveActive]: transitionName === 'send',
	})"
	:enterFromClass="normalizeClass({
		[$style.transition_modalDrawer_enterFrom]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_enterFrom]: transitionName === 'modal-popup',
		[$style.transition_modal_enterFrom]: transitionName === 'modal',
		[$style.transition_send_enterFrom]: transitionName === 'send',
	})"
	:leaveToClass="normalizeClass({
		[$style.transition_modalDrawer_leaveTo]: transitionName === 'modal-drawer',
		[$style.transition_modalPopup_leaveTo]: transitionName === 'modal-popup',
		[$style.transition_modal_leaveTo]: transitionName === 'modal',
		[$style.transition_send_leaveTo]: transitionName === 'send',
	})"
	:duration="transitionDuration"
	:css="!useMenuMotion"
	appear
	@afterLeave="onClosed"
	@enter="enterHook"
	@leave="leaveHook"
	@afterEnter="onOpened"
>
	<div v-show="manualShowing != null ? manualShowing : showing" ref="modalRootEl" v-hotkey.global="keymap" :class="[$style.root, { [$style.drawer]: type === 'drawer', [$style.dialog]: type === 'dialog', [$style.popup]: type === 'popup' }]" :style="{ zIndex, pointerEvents: (manualShowing != null ? manualShowing : showing) ? 'auto' : 'none', '--transformOrigin': transformOrigin }">
		<div data-testid="bg" :data-test-is-transparent="isEnableBgTransparent" class="_modalBg" :class="[$style.bg, { [$style.bgTransparent]: isEnableBgTransparent }]" :style="{ zIndex }" @click="onBgClick" @mousedown="onBgClick" @contextmenu.prevent.stop="() => {}"></div>
		<div ref="content" data-misutgaru-popup-content :class="[$style.content, { [$style.fixed]: fixed }]" :style="{ zIndex }" @click.self="onBgClick">
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
import { DI } from '@/di.js';
import { animateContextMenuTransition, animateElementTransition, contextMenuDrawerKeyframes, contextMenuRootKeyframes } from './MkContextMenu.motion.js';
import type { ContextMenuMotionPhase } from './MkContextMenu.motion.js';

function getFixedContainer(el: Element | null): Element | null {
	if (el == null || el.tagName === 'BODY') return null;
	const position = window.getComputedStyle(el).getPropertyValue('position');
	if (position === 'fixed') {
		return el;
	} else {
		return getFixedContainer(el.parentElement);
	}
}

type ModalTypes = 'popup' | 'dialog' | 'drawer';

const props = withDefaults(defineProps<{
	manualShowing?: boolean | null;
	anchor?: { x: string; y: string; };
	anchorElement?: HTMLElement | null;
	preferType?: ModalTypes | 'auto';
	zPriority?: 'low' | 'middle' | 'high';
	noOverlap?: boolean;
	transparentBg?: boolean;
	hasInteractionWithOtherFocusTrappedEls?: boolean;
	returnFocusTo?: HTMLElement | null;
	menuAnimation?: boolean;
}>(), {
	manualShowing: null,
	anchorElement: null,
	anchor: () => ({ x: 'center', y: 'bottom' }),
	preferType: 'auto',
	zPriority: 'low',
	noOverlap: true,
	transparentBg: false,
	hasInteractionWithOtherFocusTrappedEls: false,
	returnFocusTo: null,
	menuAnimation: false,
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
		if ((prefer.s.menuStyle === 'drawer') || (prefer.s.menuStyle === 'auto' && isTouchUsing && deviceKind === 'smartphone')) {
			return 'drawer';
		} else {
			return props.anchorElement != null ? 'popup' : 'dialog';
		}
	} else {
		return props.preferType!;
	}
});
const isEnableBgTransparent = computed(() => props.transparentBg && (type.value === 'popup'));
const transitionName = computed((() =>
	prefer.s.animation
		? useSendAnime.value
			? 'send'
			: type.value === 'drawer'
				? 'modal-drawer'
				: type.value === 'popup'
					? 'modal-popup'
					: 'modal'
		: ''
));
const transitionDuration = computed((() =>
	transitionName.value === 'send'
		? 400
		: transitionName.value === 'modal-popup'
			? 300
			: transitionName.value === 'modal'
				? 300
				: transitionName.value === 'modal-drawer'
					? 300
					: 0
));
const useMenuMotion = computed(() => props.menuAnimation && (type.value === 'popup' || type.value === 'drawer'));
const enterHook = computed(() => useMenuMotion.value ? enter : (_element: Element) => emit('opening'));
const leaveHook = computed(() => useMenuMotion.value ? leave : undefined);

function enter(element: Element, done: () => void) {
	emit('opening');
	animateMenuTransition(element, 'enter', done);
}

function leave(element: Element, done: () => void) {
	animateMenuTransition(element, 'leave', done);
}

function animateMenuTransition(element: Element, phase: ContextMenuMotionPhase, done: () => void) {
	const contentElement = element.querySelector<HTMLElement>('[data-misutgaru-popup-content]') ?? element;
	const bgElement = element.querySelector<HTMLElement>('[data-testid="bg"]');
	const keyframes = type.value === 'drawer' ? contextMenuDrawerKeyframes(phase) : contextMenuRootKeyframes(phase);
	let pending = bgElement == null ? 1 : 2;
	const finish = () => {
		pending -= 1;
		if (pending === 0) done();
	};

	animateContextMenuTransition(element, phase, finish, contentElement, keyframes);
	if (bgElement != null) {
		const targetFilter = window.getComputedStyle(bgElement).backdropFilter || 'none';
		const hidden: Keyframe = { opacity: 0, backdropFilter: 'blur(0px)' };
		const visible: Keyframe = { opacity: 1, backdropFilter: targetFilter };
		animateElementTransition(bgElement, phase === 'enter' ? [hidden, visible] : [visible, hidden], phase, finish, 'backdrop');
	}
}

let releaseFocusTrap: (() => void) | null = null;
let contentClicking = false;
let disabledAnchor: { element: HTMLElement; pointerEvents: string } | null = null;

function restoreAnchorPointerEvents() {
	if (disabledAnchor == null) return;
	disabledAnchor.element.style.pointerEvents = disabledAnchor.pointerEvents;
	disabledAnchor = null;
}

function disableAnchorPointerEvents(anchorElement: HTMLElement | null | undefined) {
	restoreAnchorPointerEvents();
	if (anchorElement == null) return;
	disabledAnchor = {
		element: anchorElement,
		pointerEvents: anchorElement.style.pointerEvents,
	};
	anchorElement.style.pointerEvents = 'none';
}

function close(opts: { useSendAnimation?: boolean } = {}) {
	if (opts.useSendAnimation) {
		useSendAnime.value = true;
	}

	restoreAnchorPointerEvents();
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

const align = () => {
	if (props.anchorElement == null) return;
	if (type.value === 'drawer') return;
	if (type.value === 'dialog') return;

	if (content.value == null) return;

	const anchorRect = props.anchorElement.getBoundingClientRect();

	const width = content.value!.offsetWidth;
	const height = content.value!.offsetHeight;
	const viewportWidth = window.document.documentElement.clientWidth;
	const viewportHeight = window.document.documentElement.clientHeight;

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
		if (left + width > viewportWidth - MARGIN) {
			left = viewportWidth - MARGIN - width;
		}

		const underSpace = (viewportHeight - MARGIN) - top;
		const upperSpace = (anchorRect.top - MARGIN);

		// 画面から縦にはみ出る場合
		if (top + height > viewportHeight - MARGIN) {
			if (props.noOverlap && props.anchor.x === 'center') {
				if (underSpace >= (upperSpace / 3)) {
					maxHeight.value = underSpace;
				} else {
					maxHeight.value = upperSpace;
					top = (upperSpace + MARGIN) - height;
				}
			} else {
				top = (viewportHeight - MARGIN) - height;
			}
		} else {
			maxHeight.value = underSpace;
		}
	} else {
		// 画面から横にはみ出る場合
		if (left + width - window.scrollX > viewportWidth - MARGIN) {
			left = viewportWidth - MARGIN - width + window.scrollX - 1;
		}

		const underSpace = (viewportHeight - MARGIN) - (top - window.scrollY);
		const upperSpace = (anchorRect.top - MARGIN);

		// 画面から縦にはみ出る場合
		if (top + height - window.scrollY > viewportHeight - MARGIN) {
			if (props.noOverlap && props.anchor.x === 'center') {
				if (underSpace >= (upperSpace / 3)) {
					maxHeight.value = underSpace;
				} else {
					maxHeight.value = upperSpace;
					top = window.scrollY + ((upperSpace + MARGIN) - height);
				}
			} else {
				top = (viewportHeight - MARGIN) - height + window.scrollY - 1;
			}
		} else {
			maxHeight.value = underSpace;
		}
	}

	const viewportLeft = (fixed.value ? 0 : window.scrollX) + MARGIN;
	const viewportTop = fixed.value ? MARGIN : window.scrollY + MARGIN;
	left = Math.max(viewportLeft, left);
	top = Math.max(viewportTop, top);

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

let contentMouseDownTarget: HTMLElement | null = null;
let contentClickResetTimer: number | null = null;

const onContentMouseUp = () => {
	if (contentClickResetTimer !== null) window.clearTimeout(contentClickResetTimer);
	// click イベントより先に mouseup イベントが発生するかもしれないのでちょっと待つ
	contentClickResetTimer = window.setTimeout(() => {
		contentClicking = false;
		contentClickResetTimer = null;
	}, 100);
};

const onContentMouseDown = () => {
	contentClicking = true;
	window.removeEventListener('mouseup', onContentMouseUp);
	window.addEventListener('mouseup', onContentMouseUp, { passive: true, once: true });
};

function detachContentClickGuard() {
	contentMouseDownTarget?.removeEventListener('mousedown', onContentMouseDown);
	contentMouseDownTarget = null;
	window.removeEventListener('mouseup', onContentMouseUp);
	if (contentClickResetTimer !== null) {
		window.clearTimeout(contentClickResetTimer);
		contentClickResetTimer = null;
	}
	contentClicking = false;
}

const onOpened = () => {
	emit('opened');

	// contentの子要素にアクセスするためレンダリングの完了を待つ必要がある（nextTickが必要）
	nextTick(() => {
		// NOTE: Chromatic テストの際に undefined になる場合がある
		if (content.value == null) return;

		// モーダルコンテンツにマウスボタンが押され、コンテンツ外でマウスボタンが離されたときにモーダルバックグラウンドクリックと判定させないためにマウスイベントを監視しフラグ管理する
		const el = content.value.children[0];
		if (!(el instanceof HTMLElement)) return;
		if (contentMouseDownTarget === el) return;
		detachContentClickGuard();
		contentMouseDownTarget = el;
		el.addEventListener('mousedown', onContentMouseDown, { passive: true });
	});
};

const onClosed = () => {
	emit('closed');
};

const alignObserver = new ResizeObserver((entries, observer) => {
	align();
});

onMounted(() => {
	watch(() => props.anchorElement, async (anchorElement) => {
		fixed.value = (type.value === 'drawer') || (getFixedContainer(anchorElement) != null);

		await nextTick();

		align();
	}, { immediate: true });

	watch([() => props.anchorElement, showing, () => props.manualShowing], ([anchorElement, showing, manualShowing]) => {
		if (manualShowing === true || (manualShowing == null && showing === true)) {
			disableAnchorPointerEvents(anchorElement);
		} else {
			restoreAnchorPointerEvents();
		}
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
		if (content.value != null) alignObserver.observe(content.value);
	});
});

onUnmounted(() => {
	alignObserver.disconnect();
	detachContentClickGuard();
	releaseFocusTrap?.();
	restoreAnchorPointerEvents();
});

defineExpose({
	close,
});
</script>

<style lang="scss" module>
.transition_send_enterActive,
.transition_send_leaveActive {
	> .bg {
		transition: opacity 0.3s !important;
	}

	> .content {
    transform: translateY(0px);
		transition: opacity 0.3s ease-in, transform 0.3s cubic-bezier(.5,-0.5,1,.5) !important;
	}
}
.transition_send_enterFrom,
.transition_send_leaveTo {
	> .bg {
		opacity: 0;
	}

	> .content {
		pointer-events: none;
		opacity: 0;
		transform: translateY(-300px);
	}
}

.transition_modal_enterActive,
.transition_modal_leaveActive {
	> .bg {
		transition: opacity 0.2s !important;
	}

	> .content {
		transform-origin: var(--transformOrigin);
		transition: opacity 0.2s, transform 0.2s !important;
	}
}
.transition_modal_enterFrom,
.transition_modal_leaveTo {
	> .bg {
		opacity: 0;
	}

	> .content {
		pointer-events: none;
		opacity: 0;
		transform-origin: var(--transformOrigin);
		transform: scale(0.9);
	}
}

.transition_modalPopup_enterActive,
.transition_modalPopup_leaveActive {
	> .bg {
		transition: opacity 0.1s !important;
	}

	> .content {
		transform-origin: var(--transformOrigin);
		transition: opacity 0.1s cubic-bezier(0, 0, 0.2, 1), transform 0.1s cubic-bezier(0, 0, 0.2, 1) !important;
	}
}
.transition_modalPopup_enterFrom,
.transition_modalPopup_leaveTo {
	> .bg {
		opacity: 0;
	}

	> .content {
		pointer-events: none;
		opacity: 0;
		transform-origin: var(--transformOrigin);
		transform: scale(0.9);
	}
}

.transition_modalDrawer_enterActive {
	> .bg {
		transition: opacity 0.2s !important;
	}

	> .content {
		transition: transform 0.2s cubic-bezier(0,.5,0,1) !important;
	}
}
.transition_modalDrawer_leaveActive {
	> .bg {
		transition: opacity 0.2s !important;
	}

	> .content {
		transition: transform 0.2s cubic-bezier(0,.5,0,1) !important;
	}
}
.transition_modalDrawer_enterFrom,
.transition_modalDrawer_leaveTo {
	> .bg {
		opacity: 0;
	}

	> .content {
		pointer-events: none;
		transform: translateY(100%);
	}
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
			display: flex;
			overflow: auto;

			@media (max-width: 500px) {
				padding: 16px;
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
	&.bgTransparent {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
}
</style>
