/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { LazyMeasurementIndex, lazyViewportOffset } from '@vune-ui/web';
import { getScrollContainer } from '@@/js/scroll.js';

export interface VariableVirtualEntry<T> {
	readonly item: T;
	readonly index: number;
	readonly key: string | number;
}

export interface VariableVirtualListOptions<T> {
	readonly items: ComputedRef<readonly T[]>;
	readonly root: Ref<HTMLElement | null | undefined>;
	readonly keyOf: (item: T, index: number) => string | number;
	readonly estimate?: number;
	readonly overscan?: number;
	readonly threshold?: number;
}

export function shouldPreserveVirtualAnchor(offset: number): boolean {
	// At the absolute start of a feed, prepended content is the thing the user
	// expects to see. Anchoring the previous first row there would immediately
	// scroll the newly-arrived item out of view. Once the viewport is genuinely
	// inside the list, preserving the logical first visible row prevents jumps.
	return Number.isFinite(offset) && offset > 1;
}

/**
 * Variable-height virtual list that keeps measurements by stable item key.
 *
 * The index itself is sparse: unmeasured rows use one estimate, while measured
 * rows contribute only their delta. Rebuilding after prepend/reorder therefore
 * preserves sizes by identity instead of accidentally attaching an old height
 * to the new row at the same numeric index.
 */
export function useVariableVirtualList<T>(options: VariableVirtualListOptions<T>) {
	const estimate = options.estimate ?? 180;
	const overscan = options.overscan ?? 5;
	const threshold = options.threshold ?? 72;
	const range = shallowRef({ start: 0, end: options.items.value.length });
	const beforeSize = shallowRef(0);
	const afterSize = shallowRef(0);
	const measurements = new Map<string | number, number>();
	const rowElements = new Map<string | number, Element>();
	const rowKeys = new WeakMap<Element, string | number>();
	let keyIndexes = new Map<string | number, number>();
	let index = new LazyMeasurementIndex(options.items.value.length, estimate, 0);
	let scrollContainer: HTMLElement | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let rootResizeObserver: ResizeObserver | null = null;
	let raf: number | null = null;
	let listeningToWindow = false;

	const enabled = computed(() => options.items.value.length >= threshold);
	// Track stable identities instead of the array ref itself. Paginator mutates
	// normal refs with unshift/splice, so a shallow watch of the returned array
	// can miss structural changes even though the rendered indices changed.
	const itemKeys = computed(() => options.items.value.map((item, index) => options.keyOf(item, index)));
	const entries = computed<readonly VariableVirtualEntry<T>[]>(() => {
		const items = options.items.value;
		const start = enabled.value ? range.value.start : 0;
		const end = enabled.value ? range.value.end : items.length;
		const result: VariableVirtualEntry<T>[] = [];
		for (let i = start; i < end; i++) result.push({ item: items[i], index: i, key: options.keyOf(items[i], i) });
		return result;
	});

	function gapForRoot(root: HTMLElement): number {
		try {
			const raw = root.ownerDocument.defaultView?.getComputedStyle(root).rowGap ?? root.style.rowGap;
			const value = Number.parseFloat(raw || '0');
			return Number.isFinite(value) && value > 0 ? value : 0;
		} catch {
			return 0;
		}
	}

	function rebuildIndex(keys: readonly (string | number)[] = itemKeys.value): void {
		const liveKeys = new Set<string | number>();
		keyIndexes = new Map();
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			liveKeys.add(key);
			keyIndexes.set(key, i);
		}
		for (const key of measurements.keys()) if (!liveKeys.has(key)) measurements.delete(key);
		const root = options.root.value;
		index = new LazyMeasurementIndex(keys.length, estimate, root ? gapForRoot(root) : 0);
		for (let i = 0; i < keys.length; i++) {
			const measured = measurements.get(keys[i]);
			if (measured !== undefined) index.set(i, measured);
		}
	}

	function viewportMetrics(root: HTMLElement): { offset: number; viewport: number } {
		const rect = root.getBoundingClientRect();
		if (scrollContainer) {
			const parentRect = scrollContainer.getBoundingClientRect();
			return {
				// Both rects are already expressed in viewport coordinates. Their
				// difference is the viewport start relative to the list; adding
				// scrollTop here would count the scroll position twice.
				offset: lazyViewportOffset(parentRect.top, rect.top),
				viewport: Math.max(1, scrollContainer.clientHeight || root.ownerDocument.defaultView?.innerHeight || 800),
			};
		}
		return {
			offset: lazyViewportOffset(0, rect.top),
			viewport: Math.max(1, root.ownerDocument.defaultView?.innerHeight || 800),
		};
	}

	function applyRange(offset: number, viewport: number): void {
		const next = index.rangeForViewport(offset, viewport, overscan);
		range.value = next;
		beforeSize.value = index.hiddenBeforeSize(next.start);
		afterSize.value = index.hiddenAfterSize(next.end);
	}

	function refreshNow(): void {
		raf = null;
		const root = options.root.value;
		const count = options.items.value.length;
		if (!root || !enabled.value || count === 0) {
			range.value = { start: 0, end: count };
			beforeSize.value = 0;
			afterSize.value = 0;
			return;
		}
		index.configure(count, estimate, gapForRoot(root));
		const metrics = viewportMetrics(root);
		applyRange(metrics.offset, metrics.viewport);
	}

	function scheduleRefresh(): void {
		if (raf !== null || typeof window === 'undefined') return;
		raf = window.requestAnimationFrame(refreshNow);
	}

	function detachScroll(): void {
		if (scrollContainer) scrollContainer.removeEventListener('scroll', scheduleRefresh);
		if (listeningToWindow && typeof window !== 'undefined') window.removeEventListener('scroll', scheduleRefresh);
		scrollContainer = null;
		listeningToWindow = false;
	}

	function attachRoot(root: HTMLElement | null | undefined): void {
		detachScroll();
		resizeObserver?.disconnect();
		rootResizeObserver?.disconnect();
		rowElements.clear();
		resizeObserver = null;
		rootResizeObserver = null;
		if (!root) return;
		scrollContainer = getScrollContainer(root);
		if (scrollContainer) scrollContainer.addEventListener('scroll', scheduleRefresh, { passive: true });
		else if (typeof window !== 'undefined') {
			window.addEventListener('scroll', scheduleRefresh, { passive: true });
			listeningToWindow = true;
		}
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(records => {
				let anchorDelta = 0;
				const rootNow = options.root.value;
				const metrics = rootNow ? viewportMetrics(rootNow) : undefined;
				const firstVisible = metrics ? index.indexAtOffset(metrics.offset) : 0;
				for (const record of records) {
					const element = record.target as HTMLElement;
					// ResizeObserver delivery can lag behind a prepend/reorder. Numeric
					// data-virtual-index then describes the old render and may point at a
					// different note in the current array. Resolve by stable identity so
					// a delayed measurement can never be attached to the wrong row.
					const key = rowKeys.get(element);
					const rowIndex = key === undefined ? undefined : keyIndexes.get(key);
					if (key === undefined || rowIndex === undefined || rowIndex < 0 || rowIndex >= options.items.value.length) continue;
					const borderBox = Array.isArray(record.borderBoxSize) ? record.borderBoxSize[0] : record.borderBoxSize;
					const size = Math.max(1, borderBox?.blockSize ?? element.getBoundingClientRect().height);
					const delta = index.set(rowIndex, size);
					measurements.set(key, size);
					if (delta !== 0 && rowIndex < firstVisible) anchorDelta += delta;
				}
				if (anchorDelta !== 0) {
					if (scrollContainer) scrollContainer.scrollTop += anchorDelta;
					else if (typeof window !== 'undefined') window.scrollBy(0, anchorDelta);
				}
				scheduleRefresh();
			});
			rootResizeObserver = new ResizeObserver(scheduleRefresh);
			rootResizeObserver.observe(root);
		}
		rebuildIndex();
		scheduleRefresh();
	}

	function observeRow(element: Element | null, entry: VariableVirtualEntry<T>): void {
		const previous = rowElements.get(entry.key);
		if (!element) {
			if (previous) {
				resizeObserver?.unobserve(previous);
				rowKeys.delete(previous);
			}
			rowElements.delete(entry.key);
			return;
		}
		if (!(element instanceof HTMLElement) || !resizeObserver) return;
		if (previous && previous !== element) {
			resizeObserver.unobserve(previous);
			rowKeys.delete(previous);
		}
		rowElements.set(entry.key, element);
		rowKeys.set(element, entry.key);
		resizeObserver.observe(element);
	}

	watch(options.root, root => attachRoot(root), { immediate: true });
	watch(itemKeys, async (keys, previousKeys = []) => {
		const root = options.root.value;
		let targetOffset: number | null = null;
		let viewport = 0;

		// Preserve the logical first visible item across prepend/remove/reorder.
		// Capture it against the old sparse index before rebuilding from the new
		// key order, then render the new range for its future offset before the DOM
		// changes. The scroll correction is applied after nextTick when the new
		// spacer height is actually scrollable.
		if (root && enabled.value && previousKeys.length > 0 && index.count === previousKeys.length) {
			const metrics = viewportMetrics(root);
			if (shouldPreserveVirtualAnchor(metrics.offset)) {
				const oldAnchorIndex = index.indexAtOffset(metrics.offset);
				const anchorKey = previousKeys[oldAnchorIndex];
				const withinAnchor = metrics.offset - index.offsetForIndex(oldAnchorIndex);
				rebuildIndex(keys);
				const newAnchorIndex = keyIndexes.get(anchorKey) ?? -1;
				if (newAnchorIndex >= 0) {
					targetOffset = Math.max(0, index.offsetForIndex(newAnchorIndex) + withinAnchor);
					viewport = metrics.viewport;
					applyRange(targetOffset, viewport);
				}
			} else {
				rebuildIndex(keys);
			}
		} else {
			rebuildIndex(keys);
		}

		await nextTick();
		if (targetOffset !== null && root != null && root === options.root.value) {
			const currentOffset = viewportMetrics(root).offset;
			const delta = targetOffset - currentOffset;
			if (Math.abs(delta) >= 0.5) {
				if (scrollContainer) scrollContainer.scrollTop += delta;
				else if (typeof window !== 'undefined') window.scrollBy(0, delta);
			}
		}
		scheduleRefresh();
	}, { deep: false });
	watch(enabled, () => scheduleRefresh());

	onBeforeUnmount(() => {
		detachScroll();
		resizeObserver?.disconnect();
		rootResizeObserver?.disconnect();
		rowElements.clear();
		if (raf !== null && typeof window !== 'undefined') window.cancelAnimationFrame(raf);
	});

	return { enabled, entries, range, beforeSize, afterSize, observeRow, refresh: scheduleRefresh };
}
