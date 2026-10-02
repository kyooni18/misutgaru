/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { animateMotion } from './animation.js';
import type { MotionAnimateOptions, MotionHandle } from './types.js';

export interface LayoutSnapshot {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface LayoutMotionOptions extends Omit<MotionAnimateOptions, 'properties'> {
	translate?: boolean;
	scale?: boolean;
}

export function captureLayout(element: Element): LayoutSnapshot {
	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
}

export function animateLayoutChange(
	element: Element,
	from: LayoutSnapshot,
	to: LayoutSnapshot,
	options: LayoutMotionOptions = {},
): MotionHandle | null {
	if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return null;
	const { translate: translateEnabled, scale: scaleEnabled, ...motionOptions } = options;
	const useTranslate = translateEnabled ?? true;
	const useScale = scaleEnabled ?? true;
	const deltaX = from.left - to.left;
	const deltaY = from.top - to.top;
	const scaleX = to.width > 0 ? from.width / to.width : 1;
	const scaleY = to.height > 0 ? from.height / to.height : 1;
	const moved = useTranslate && (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5);
	const resized = useScale && (Math.abs(scaleX - 1) > 0.002 || Math.abs(scaleY - 1) > 0.002);
	if (!moved && !resized) return null;

	const start: Keyframe = {};
	const end: Keyframe = {};
	const properties: string[] = [];
	if (moved) {
		start.translate = `${deltaX}px ${deltaY}px`;
		end.translate = '0 0';
		properties.push('translate');
	}
	if (resized) {
		start.scale = `${scaleX} ${scaleY}`;
		end.scale = '1 1';
		properties.push('scale');
	}

	const previousTransformOrigin = element.style.transformOrigin;
	const previousTranslate = element.style.translate;
	const previousScale = element.style.scale;
	element.style.transformOrigin = '0 0';
	const handle = animateMotion(element, [start, end], {
		...motionOptions,
		preset: motionOptions.preset ?? 'layout',
		category: motionOptions.category ?? 'spatial',
		properties,
	});
	void handle.finished.then(status => {
		if (element.style.transformOrigin === '0px 0px' || element.style.transformOrigin === '0 0') {
			element.style.transformOrigin = previousTransformOrigin;
		}
		if (status === 'finished') {
			if (moved) element.style.translate = previousTranslate;
			if (resized) element.style.scale = previousScale;
		}
	});
	return handle;
}
