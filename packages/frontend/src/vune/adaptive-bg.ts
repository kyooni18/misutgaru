/* SPDX-License-Identifier: AGPL-3.0-only */
import { getBgColor } from '@/utility/get-bg-color.js';

export function adaptiveBgRef(element: Element | null): void {
	if (!(element instanceof HTMLElement)) return;
	queueMicrotask(() => {
		if (!element.isConnected) return;
		const parentBg = getBgColor(element.parentElement) ?? 'transparent';
		const myBg = window.getComputedStyle(element).backgroundColor;
		element.style.backgroundColor = parentBg === myBg ? 'var(--MI_THEME-bg)' : myBg;
	});
}
