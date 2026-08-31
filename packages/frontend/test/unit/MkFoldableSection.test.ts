/* SPDX-License-Identifier: AGPL-3.0-only */
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { afterEach, describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';

afterEach(() => cleanup());

describe('MkFoldableSection', () => {
	test('renders through the Vune host and animates the collapsed state', async () => {
		const result = render(MkFoldableSection, {
			slots: {
				header: () => 'Section title',
				default: () => 'Section body',
			},
		});

		const header = result.container.querySelector<HTMLElement>('[data-vune-foldable-header]');
		const body = result.container.querySelector<HTMLElement>('[data-vune-foldable-body]');
		expect(header).not.toBeNull();
		expect(body).not.toBeNull();
		expect(body?.getAttribute('aria-hidden')).toBe('false');
		expect(body?.querySelector('[data-vune-foldable-content]')?.textContent).toContain('Section body');

		await fireEvent.click(header!);

		expect(body?.getAttribute('aria-hidden')).toBe('true');
		expect(body?.style.height).toBe('0px');
		expect(body?.style.opacity).toBe('0');
		expect(header?.querySelector('.ti-chevron-down')).not.toBeNull();
	});

	test('measures the body after Vune content is mounted', async () => {
		const originalResizeObserver = globalThis.ResizeObserver;
		let triggerResize: (() => void) | undefined;
		globalThis.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				triggerResize = () => callback([], {} as ResizeObserver);
			}
			observe() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;

		try {
			const result = render(MkFoldableSection, {
				slots: {
					default: () => 'Tall section body',
				},
			});
			const content = result.container.querySelector<HTMLElement>('[data-vune-foldable-content]');
			const body = result.container.querySelector<HTMLElement>('[data-vune-foldable-body]');
			expect(content).not.toBeNull();
			expect(body).not.toBeNull();

			Object.defineProperty(content!, 'scrollHeight', { configurable: true, value: 240 });
			await nextTick();
			triggerResize?.();
			await nextTick();

			expect(body?.style.height).toBe('240px');
		} finally {
			globalThis.ResizeObserver = originalResizeObserver;
		}
	});
});
