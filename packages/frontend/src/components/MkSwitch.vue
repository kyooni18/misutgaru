<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.disabled]: disabled }]">
	<NativeMkSwitch :checked="visualChecked" :disabled="disabled" :onToggle="toggle"/>
	<span v-if="!noBody" :class="$style.body">
		<!-- TODO: 無名slotの方は廃止 -->
		<span :class="$style.label">
			<span @click="toggleFromLabel">
				<slot name="label"></slot><slot></slot>
			</span>
			<span v-if="helpText" v-tooltip:dialog="helpText" class="_button _help" :class="$style.help"><i class="ti ti-help-circle"></i></span>
		</span>
		<p :class="$style.caption"><slot name="caption"></slot></p>
	</span>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, unref, watch } from 'vue';
import type { Ref } from 'vue';
import { haptic } from '@/utility/haptic.js';
import VuneMkSwitchButton from '@/components/vune/MkSwitchButton.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const NativeMkSwitch = createVuneWebHost(VuneMkSwitchButton);

const props = defineProps<{
	modelValue: boolean | Ref<boolean>;
	disabled?: boolean;
	helpText?: string;
	noBody?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', v: boolean): void;
	(ev: 'change', v: boolean): void;
}>();

const checked = computed(() => unref(props.modelValue));

// Keep interaction feedback local to the control instead of waiting for the
// v-model round trip through the parent. External changes still remain the
// source of truth and resynchronize the presentation immediately.
const visualChecked = ref(checked.value);
watch(checked, value => {
	visualChecked.value = value;
}, { flush: 'sync' });

const toggle = (next: boolean) => {
	if (props.disabled) return;
	if (next === visualChecked.value && next === checked.value) return;
	visualChecked.value = next;
	emit('update:modelValue', next);
	emit('change', next);

	// The parent remains authoritative. If a controlled parent rejects the
	// update, restore its value after Vue has had a chance to propagate v-model.
	void nextTick(() => {
		if (visualChecked.value !== checked.value) visualChecked.value = checked.value;
	});

	haptic();
};

const toggleFromLabel = () => toggle(!visualChecked.value);
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: flex;
	transition: opacity 0.2s ease;
	user-select: none;

	&.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
}

.body {
	margin-left: 12px;
	margin-top: 2px;
	display: block;
	transition: inherit;
	color: var(--MI_THEME-fg);
}

.label {
	display: block;
	line-height: 20px;
	cursor: pointer;
	transition: inherit;
}

.caption {
	margin: 8px 0 0 0;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
	font-size: 0.85em;

	&:empty {
		display: none;
	}
}

.help {
	margin-left: 0.5em;
	font-size: 85%;
	vertical-align: top;
}
</style>
