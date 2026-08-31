<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component
	:is="component"
	ref="el"
	class="_button"
	:class="[$style.root, { [$style.inline]: inline, [$style.primary]: primary, [$style.gradate]: gradate, [$style.danger]: danger, [$style.rounded]: rounded, [$style.full]: full, [$style.small]: small, [$style.large]: large, [$style.transparent]: transparent, [$style.asLike]: asLike, [$style.iconOnly]: iconOnly, [$style.wait]: wait, [$style.active]: active }]"
	v-bind="cProps"
	@click="emit('click', $event)"
>
	<div :class="$style.content">
		<slot></slot>
	</div>
</component>
</template>

<script lang="ts" setup>
import { nextTick, computed, onMounted, useTemplateRef } from 'vue';
import MkA from '@/components/global/MkA.vue';
import type { MkABehavior } from '@/components/global/MkA.vue';

const props = defineProps<{
	type?: 'button' | 'submit' | 'reset' | 'a' | 'routerLink';
	primary?: boolean;
	gradate?: boolean;
	rounded?: boolean;
	inline?: boolean;
	autofocus?: boolean;
	wait?: boolean;
	danger?: boolean;
	full?: boolean;
	small?: boolean;
	large?: boolean;
	transparent?: boolean;
	asLike?: boolean;
	iconOnly?: boolean;
	active?: boolean;

	// for type=button
	name?: string;
	value?: string;
	disabled?: boolean;

	// for type=a
	href?: string;
	target?: string;
	rel?: string;

	// for type=routerLink
	to?: string;
	linkBehavior?: MkABehavior;
}>();

const emit = defineEmits<{
	(ev: 'click', payload: PointerEvent): void;
}>();

const el = useTemplateRef('el');

const component = computed(() => {
	if (props.type === 'a') return 'a';
	if (props.type === 'routerLink') return MkA;
	return 'button';
});
const cProps = computed(() => {
	if (props.type === 'a') return { href: props.href ?? '#', target: props.target, rel: props.rel };
	if (props.type === 'routerLink') return { to: props.to!, behavior: props.linkBehavior };
	return {
		type: props.type ?? 'button',
		name: props.name,
		value: props.value,
		disabled: props.disabled || props.wait,
	};
});

onMounted(() => {
	if (props.autofocus) {
		nextTick(() => {
			el.value!.focus();
		});
	}
});
</script>

<style lang="scss" module>
.root {
	--mk-button-padding-y: var(--MI-button-padding-y);
	--mk-button-padding-x: var(--MI-button-padding-x);

	display: block;
	width: max-content;
	padding: var(--mk-button-padding-y) var(--mk-button-padding-x);
	text-align: center;
	font-weight: var(--MI-button-font-weight);
	font-size: 95%;
	line-height: 1.15;
	box-shadow: var(--MI-button-shadow);
	text-decoration: none;
	background: var(--MI-button-surface);
	border: thin solid var(--MI-button-border);
	border-radius: var(--MI-button-radius);
	overflow: clip;
	box-sizing: border-box;
	transition:
		background var(--MI-motion-duration-fast) var(--MI-motion-ease-standard),
		border-color var(--MI-motion-duration-fast) var(--MI-motion-ease-standard),
		box-shadow var(--MI-motion-duration-fast) var(--MI-motion-ease-standard),
		color var(--MI-motion-duration-fast) var(--MI-motion-ease-standard),
		opacity var(--MI-motion-duration-fast) var(--MI-motion-ease-standard);

	&:hover {
		text-decoration: none;
	}

	&:not(:disabled):hover {
		background: var(--MI-button-surface-hover);
		border-color: var(--MI-button-border-hover);
		box-shadow: 0 0.18em 0.55em color-mix(in srgb, var(--MI_THEME-shadow) 10%, transparent), inset 0 0.04em 0 color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent);
	}

	&:not(:disabled):active {
		background: var(--MI-button-surface-pressed);
		border-color: var(--MI-button-border-hover);
		box-shadow: var(--MI-button-shadow-pressed);
	}

	&.iconOnly {
		padding-inline: var(--mk-button-padding-y);
	}

	&.small {
		--mk-button-padding-y: var(--MI-button-padding-y-small);
		--mk-button-padding-x: var(--MI-button-padding-x-small);

		font-size: 90%;
	}

	&.large {
		--mk-button-padding-y: var(--MI-button-padding-y-large);
		--mk-button-padding-x: var(--MI-button-padding-x-large);

		font-size: 100%;
	}

	&.full {
		width: 100%;
	}

	&.rounded {
		border-radius: calc(1em + var(--mk-button-padding-y));
	}

	&.primary {
		color: var(--MI_THEME-accent) !important;
		background: var(--MI-button-accent-surface);
		border-color: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
		box-shadow: none;

		&:not(:disabled):hover {
			background: var(--MI-button-accent-surface-hover);
			border-color: color-mix(in srgb, var(--MI_THEME-accent) 16%, transparent);
			box-shadow: none;
		}

		&:not(:disabled):active {
			background: var(--MI-button-accent-surface-pressed);
			box-shadow: var(--MI-button-shadow-pressed);
		}
	}

	&.asLike {
		color: var(--MI_THEME-love);
		background: color-mix(in srgb, var(--MI_THEME-love) 10%, transparent);
		border-color: color-mix(in srgb, var(--MI_THEME-love) 8%, transparent);

		&:not(:disabled):hover {
			background: color-mix(in srgb, var(--MI_THEME-love) 16%, transparent);
			border-color: color-mix(in srgb, var(--MI_THEME-love) 14%, transparent);
		}

		&:not(:disabled):active {
			background: color-mix(in srgb, var(--MI_THEME-love) 22%, transparent);
		}

		&.primary {
			color: var(--MI_THEME-love) !important;
			background: color-mix(in srgb, var(--MI_THEME-love) 18%, transparent);
			border-color: color-mix(in srgb, var(--MI_THEME-love) 10%, transparent);
			box-shadow: none;

			&:not(:disabled):hover {
				background: color-mix(in srgb, var(--MI_THEME-love) 24%, transparent);
				border-color: color-mix(in srgb, var(--MI_THEME-love) 16%, transparent);
				box-shadow: none;
			}

			&:not(:disabled):active {
				background: color-mix(in srgb, var(--MI_THEME-love) 30%, transparent);
				box-shadow: var(--MI-button-shadow-pressed);
			}
		}
	}

	&.transparent {
		background: transparent;
		border-color: transparent;
		box-shadow: none;

		&:not(:disabled):hover {
			background: var(--MI-button-surface-hover);
			border-color: transparent;
			box-shadow: none;
		}

		&:not(:disabled):active {
			background: var(--MI-button-surface-pressed);
			box-shadow: none;
		}
	}

	&.gradate {
		color: var(--MI_THEME-fg) !important;
		background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-buttonGradateA) 18%, transparent), color-mix(in srgb, var(--MI_THEME-buttonGradateB) 18%, transparent));
		border-color: color-mix(in srgb, var(--MI_THEME-buttonGradateA) 10%, transparent);
		box-shadow: none;

		&:not(:disabled):hover {
			background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-buttonGradateA) 24%, transparent), color-mix(in srgb, var(--MI_THEME-buttonGradateB) 24%, transparent));
			box-shadow: none;
		}

		&:not(:disabled):active {
			background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-buttonGradateA) 30%, transparent), color-mix(in srgb, var(--MI_THEME-buttonGradateB) 30%, transparent));
			box-shadow: var(--MI-button-shadow-pressed);
		}
	}

	&.danger {
		color: var(--MI_THEME-error);
		background: color-mix(in srgb, var(--MI_THEME-error) 10%, transparent);
		border-color: color-mix(in srgb, var(--MI_THEME-error) 8%, transparent);

		&:not(:disabled):hover {
			background: color-mix(in srgb, var(--MI_THEME-error) 16%, transparent);
			border-color: color-mix(in srgb, var(--MI_THEME-error) 14%, transparent);
		}

		&:not(:disabled):active {
			background: color-mix(in srgb, var(--MI_THEME-error) 22%, transparent);
		}

		&.primary {
			color: var(--MI_THEME-error) !important;
			background: color-mix(in srgb, var(--MI_THEME-error) 18%, transparent);
			border-color: color-mix(in srgb, var(--MI_THEME-error) 10%, transparent);
			box-shadow: none;

			&:not(:disabled):hover {
				background: color-mix(in srgb, var(--MI_THEME-error) 24%, transparent);
				border-color: color-mix(in srgb, var(--MI_THEME-error) 16%, transparent);
				box-shadow: none;
			}

			&:not(:disabled):active {
				background: color-mix(in srgb, var(--MI_THEME-error) 30%, transparent);
				box-shadow: var(--MI-button-shadow-pressed);
			}
		}
	}

	&.active:not(.primary):not(.gradate):not(.danger):not(.asLike) {
		color: var(--MI_THEME-accent) !important;
		background: var(--MI-button-accent-surface);
		border-color: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
	}

	&:disabled {
		opacity: 0.45;
		box-shadow: none;
	}

	&.wait {
		cursor: wait !important;
	}

	&:focus-visible {
		outline: 0.12em solid var(--MI_THEME-focus);
		outline-offset: 0.12em;
	}

	&.inline {
		display: inline-block;
		width: auto;
	}
}

.content {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.45em;
	min-width: 0;
	pointer-events: none;
}
</style>
