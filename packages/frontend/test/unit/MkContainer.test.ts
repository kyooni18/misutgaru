/* SPDX-License-Identifier: AGPL-3.0-only */
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { afterEach, describe, expect, test } from 'vitest';
import { defineComponent, h, nextTick, onMounted, ref } from 'vue';
import MkContainer from '@/components/MkContainer.vue';

afterEach(() => cleanup());

describe('MkContainer', () => {
	test('renders Vune-owned container markup and toggles its animated body', async () => {
		const result = render(MkContainer, {
			props: {
				foldable: true,
			},
			attrs: {
				class: 'custom-container',
				'data-testid': 'vune-container',
				'data-transparent': 'true',
				style: 'height: 42px;',
			},
			slots: {
				icon: () => h('i', { class: 'ti ti-box' }),
				header: () => 'Panel title',
				func: (slotProps: { buttonStyleClass?: string }) => h('button', {
					class: slotProps.buttonStyleClass,
				}, 'Configure'),
				default: () => 'Panel body',
			},
		});

		const root = result.container.querySelector<HTMLElement>('[data-testid="vune-container"]');
		const header = root?.querySelector<HTMLElement>('[data-vune-container-header]');
		const body = root?.querySelector<HTMLElement>('[data-vune-container-body]');
		const toggle = root?.querySelector<HTMLButtonElement>('[aria-expanded]');

		expect(root).not.toBeNull();
		expect(root?.classList.contains('mk-vune-container')).toBe(true);
		expect(root?.classList.contains('custom-container')).toBe(true);
		expect(root?.getAttribute('data-transparent')).toBe('true');
		expect(root?.style.height).toBe('42px');
		expect(header?.textContent).toContain('Panel title');
		expect(body?.textContent).toContain('Panel body');
		expect(root?.querySelector('.mk-vune-container__header-button')?.textContent).toContain('Configure');
		expect(toggle?.getAttribute('aria-expanded')).toBe('true');
		expect(body?.getAttribute('aria-hidden')).toBe('false');

		await fireEvent.click(toggle!);

		expect(toggle?.getAttribute('aria-expanded')).toBe('false');
		expect(body?.getAttribute('aria-hidden')).toBe('true');
		expect(body?.style.height).toBe('0px');
		expect(body?.style.opacity).toBe('0');
	});

	test('keeps the Vune content height capped and exposes the show-more action', async () => {
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
			const TallContent = defineComponent({
				setup() {
					const element = ref<HTMLElement | null>(null);
					onMounted(() => {
						Object.defineProperty(element.value, 'scrollHeight', { configurable: true, value: 240 });
					});
					return () => h('div', { ref: element }, 'Tall panel body');
				},
			});

			const result = render(MkContainer, {
				props: { maxHeight: 100 },
				slots: { default: () => h(TallContent) },
			});
			const content = result.container.querySelector<HTMLElement>('[data-vune-container-content]');
			expect(content).not.toBeNull();
			Object.defineProperty(content!, 'scrollHeight', { configurable: true, value: 240 });
			triggerResize?.();
			await nextTick();

			const cappedContent = result.container.querySelector<HTMLElement>('[data-vune-container-content]');
			const fade = result.container.querySelector<HTMLButtonElement>('.mk-vune-container__fade');
			expect(cappedContent?.classList.contains('mk-vune-container__content--omitted')).toBe(true);
			expect(cappedContent?.style.maxHeight).toBe('100px');
			expect(fade).not.toBeNull();

			await fireEvent.click(fade!);

			const expandedContent = result.container.querySelector<HTMLElement>('[data-vune-container-content]');
			const expandedBody = result.container.querySelector<HTMLElement>('[data-vune-container-body]');
			expect(expandedContent?.classList.contains('mk-vune-container__content--omitted')).toBe(false);
			expect(expandedBody?.style.height).toBe('240px');
			expect(result.container.querySelector('.mk-vune-container__fade')).toBeNull();
		} finally {
			globalThis.ResizeObserver = originalResizeObserver;
		}
	});
});
