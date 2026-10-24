/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Binding } from '@mun/core/compat';
import type { Ref, ShallowRef } from 'vue';

// Mün text controls write their binding on every input event and re-apply
// `value` on every render. Mirror v-model instead: hold writes while an IME
// composition is in progress and read the live field meanwhile, so a re-render
// never overwrites the text being composed.
export function imeTextBinding(source: Ref<string | null>, el: ShallowRef<HTMLInputElement | HTMLTextAreaElement | null>) {
	let composing = false;
	return {
		binding: Binding(
			() => composing && el.value ? el.value.value : source.value ?? '',
			(value: string) => { if (!composing) source.value = value; },
		),
		onCompositionstart: () => { composing = true; },
		onCompositionend: () => {
			composing = false;
			if (el.value) source.value = el.value.value;
		},
	};
}
