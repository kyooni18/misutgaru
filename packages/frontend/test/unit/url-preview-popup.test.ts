/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import { nextTick } from 'vue';
import MkUrlPreviewPopup from '@/components/MkUrlPreviewPopup.vue';

vi.mock('@/components/vune/MkUrlPreviewPopup.vune', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			setup() {
				return () => h('div', { class: 'mk-vune-url-preview-popup' });
			},
		}),
	};
});

describe('MkUrlPreviewPopup', () => {
	afterEach(() => cleanup());

	test('closes when hover ends before the async popup mounts', () => {
		const closed = vi.fn();

		render(MkUrlPreviewPopup, {
			props: {
				showing: false,
				url: 'https://example.local',
				anchorElement: document.createElement('a'),
				onClosed: closed,
			},
		});

		assert.strictEqual(closed.mock.calls.length, 1);
	});

	test('closes after the visible popup loses its hover state', async () => {
		const closed = vi.fn();
		const props = {
			showing: true,
			url: 'https://example.local',
			anchorElement: document.createElement('a'),
			onClosed: closed,
		};
		const result = render(MkUrlPreviewPopup, { props });

		await nextTick();
		await result.rerender({ ...props, showing: false });
		await nextTick();

		assert.strictEqual(closed.mock.calls.length, 1);
	});
});
