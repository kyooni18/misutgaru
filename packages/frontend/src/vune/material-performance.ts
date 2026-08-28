/* SPDX-License-Identifier: AGPL-3.0-only */

let installed = false;
let clearTimer: number | undefined;

/**
 * Keep expensive backdrop work out of the hottest scroll frames without
 * changing Material semantics. The full quality returns shortly after the
 * scroll settles. Reduced-transparency remains owned by CSS media queries.
 */
export function installMaterialPerformancePolicy(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	const root = window.document.documentElement;
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	if (connection?.saveData) root.dataset.vuneMaterialEconomy = 'true';

	const markScrolling = () => {
		root.dataset.vuneScrolling = 'true';
		if (clearTimer !== undefined) window.clearTimeout(clearTimer);
		clearTimer = window.setTimeout(() => {
			delete root.dataset.vuneScrolling;
			clearTimer = undefined;
		}, 140);
	};
	// Scroll does not bubble, so capture at document level to cover timelines,
	// sheets and nested deck columns with one listener.
	window.document.addEventListener('scroll', markScrolling, { capture: true, passive: true });
}
