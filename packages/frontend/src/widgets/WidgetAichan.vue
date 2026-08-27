<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :naked="widgetProps.transparent" :showHeader="false" data-testid="mkw-aichan" class="mkw-aichan">
	<iframe ref="live2d" :class="$style.root" src="https://misskey-dev.github.io/mascot-web/?scale=1.5&y=1.1&eyeY=100" @click="touched"></iframe>
</MkContainer>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import { i18n } from '@/i18n.js';
import type { WidgetComponentProps, WidgetComponentEmits, WidgetComponentExpose } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';

const name = 'aichan';

const widgetPropsDef = {
	transparent: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.transparent,
		default: false,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const live2d = useTemplateRef('live2d');

const touched = () => {
	//if (this.live2d) this.live2d.changeExpression('gurugurume');
};

let cursorRaf: number | null = null;
let cursorX = 0;
let cursorY = 0;
let widgetVisible = true;
let visibilityObserver: IntersectionObserver | null = null;

const onMousemove = (ev: MouseEvent) => {
	if (!widgetVisible || document.visibilityState !== 'visible') return;
	cursorX = ev.clientX;
	cursorY = ev.clientY;
	if (cursorRaf != null) return;
	cursorRaf = window.requestAnimationFrame(() => {
		cursorRaf = null;
		const frame = live2d.value;
		if (!frame?.contentWindow) return;
		const iframeRect = frame.getBoundingClientRect();
		frame.contentWindow.postMessage({
			type: 'moveCursor',
			body: {
				x: cursorX - iframeRect.left,
				y: cursorY - iframeRect.top,
			},
		}, '*');
	});
};

onMounted(() => {
	if (typeof IntersectionObserver !== 'undefined' && live2d.value) {
		visibilityObserver = new IntersectionObserver(entries => {
			widgetVisible = entries.some(entry => entry.isIntersecting);
		}, { rootMargin: '96px' });
		visibilityObserver.observe(live2d.value);
	}
	window.addEventListener('mousemove', onMousemove, { passive: true });
});

onUnmounted(() => {
	if (cursorRaf != null) window.cancelAnimationFrame(cursorRaf);
	visibilityObserver?.disconnect();
	visibilityObserver = null;
	window.removeEventListener('mousemove', onMousemove);
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	width: 100%;
	height: 350px;
	border: none;
	pointer-events: none;
	color-scheme: light;
}
</style>
