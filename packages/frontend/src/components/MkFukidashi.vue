<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneFukidashi :tail="tail" :negativeMargin="negativeMargin" :shadow="shadow" :accented="accented" :fullWidth="fullWidth" :classes="$style"><slot></slot></VuneFukidashi>
</template>

<script setup lang="ts">
import VuneFukidashi from './vune/MkFukidashi.vune';
withDefaults(defineProps<{
	tail?: 'left' | 'right' | 'none';
	negativeMargin?: boolean;
	shadow?: boolean;
	accented?: boolean;
	fullWidth?: boolean;
}>(), {
	tail: 'right',
	negativeMargin: false,
	shadow: false,
	accented: false,
	fullWidth: false,
});
</script>

<style module lang="scss">
.root {
	--fukidashi-radius: var(--MI-radius);
	--fukidashi-bg: var(--MI_THEME-panel);

	position: relative;
	display: inline-block;
	min-height: calc(var(--fukidashi-radius) * 2);
	padding-top: calc(var(--fukidashi-radius) * .13);

	&.accented {
		--fukidashi-bg: color-mix(in srgb, var(--MI_THEME-accent), var(--MI_THEME-panel) 85%);
	}

	&.shadow {
		filter: drop-shadow(0 4px 32px var(--MI_THEME-shadow));
	}

	&.left {
		padding-left: calc(var(--fukidashi-radius) * .13);

		&.negativeMargin {
			margin-left: calc(calc(var(--fukidashi-radius) * .13) * -1);
		}
	}

	&.right {
		padding-right: calc(var(--fukidashi-radius) * .13);

		&.negativeMargin {
			margin-right: calc(calc(var(--fukidashi-radius) * .13) * -1);
		}
	}

	&.fullWidth {
		width: 100%;

		&.content {
			width: 100%;
		}
	}
}

.bg {
	width: 100%;
	height: 100%;
	background: var(--fukidashi-bg);
	border-radius: var(--fukidashi-radius);
}

.content {
	position: relative;
	padding: 10px 14px;
	box-sizing: border-box;
}

@container (max-width: 450px) {
	.content {
		padding: 8px 12px;
	}
}

.tail {
	position: absolute;
	top: 0;
	display: block;
	width: calc(var(--fukidashi-radius) * 1.13);
	height: auto;
	fill: var(--fukidashi-bg);
}

.left .tail {
	left: 0;
	transform: rotateY(180deg);
}

.right .tail {
	right: 0;
}
</style>
