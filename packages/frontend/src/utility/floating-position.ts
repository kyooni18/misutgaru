/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type FloatingRect = { left: number; top: number; width: number; height: number; };
type Side = 'bottom' | 'top' | 'right' | 'left';

/** Flip when the preferred side cannot fit, then size/shift within the boundary. */
export function placeFloating(reference: FloatingRect, size: { width: number; height: number }, boundary: FloatingRect, preferred: 'bottom' | 'right', gap: number) {
	const right = boundary.left + boundary.width;
	const bottom = boundary.top + boundary.height;
	const room = {
		bottom: Math.max(0, bottom - reference.top - reference.height - gap),
		top: Math.max(0, reference.top - gap - boundary.top),
		right: Math.max(0, right - reference.left - reference.width - gap),
		left: Math.max(0, reference.left - gap - boundary.left),
	};
	const opposite = preferred === 'bottom' ? 'top' : 'left';
	const extent = preferred === 'bottom' ? size.height : size.width;
	const side: Side = extent <= room[preferred] ? preferred : extent <= room[opposite] ? opposite : room[preferred] >= room[opposite] ? preferred : opposite;
	// A submenu may overlap its parent when neither horizontal side fits. Preserve
	// its usable width instead of pushing it offscreen or squeezing its labels.
	const width = Math.min(size.width, boundary.width);
	const height = Math.min(size.height, boundary.height, preferred === 'bottom' ? room[side] || boundary.height : boundary.height);
	let left = reference.left;
	let top = reference.top;
	if (side === 'bottom') top += reference.height + gap;
	if (side === 'top') top -= height + gap;
	if (side === 'right') left += reference.width + gap;
	if (side === 'left') left -= width + gap;
	if (preferred === 'bottom' && reference.left + reference.width / 2 > boundary.left + boundary.width / 2) left = reference.left + reference.width - width;
	left = Math.max(boundary.left, Math.min(left, right - width));
	top = Math.max(boundary.top, Math.min(top, bottom - height));
	return { left, top, width, height, side };
}

/** Layout coordinates, excluding browser chrome, the keyboard and safe areas. */
export function floatingBoundary(element: HTMLElement): FloatingRect {
	const viewport = window.visualViewport;
	const style = getComputedStyle(element);
	const inset = (edge: string) => parseFloat(style.getPropertyValue(`padding-${edge}`)) || 0;
	const left = (viewport?.offsetLeft ?? 0) + inset('left');
	const top = (viewport?.offsetTop ?? 0) + inset('top');
	return {
		left,
		top,
		width: Math.max(0, (viewport?.width ?? window.document.documentElement.clientWidth) - inset('left') - inset('right')),
		height: Math.max(0, (viewport?.height ?? window.document.documentElement.clientHeight) - inset('top') - inset('bottom')),
	};
}

/** Measure at viewport capacity before choosing a side; old caps must not cause flips. */
export function measureFloating(element: HTMLElement, boundary: FloatingRect) {
	element.style.width = 'max-content';
	element.style.maxWidth = `${boundary.width}px`;
	element.style.setProperty('--MI-popup-max-width', `${boundary.width}px`);
	element.style.setProperty('--MI-popup-max-height', `${boundary.height}px`);
	return { width: element.offsetWidth, height: element.offsetHeight };
}
