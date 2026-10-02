/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MotionValue } from './motion-value.js';

export function bindMotionStyle<T>(
	element: HTMLElement | SVGElement,
	property: string,
	value: MotionValue<T>,
	serialize: (value: T) => string = String,
): () => void {
	const previous = property.startsWith('--')
		? element.style.getPropertyValue(property)
		: (element.style as unknown as Record<string, string>)[property] ?? '';
	const apply = (next: T) => {
		if (property.startsWith('--')) element.style.setProperty(property, serialize(next));
		else (element.style as unknown as Record<string, string>)[property] = serialize(next);
	};
	const unsubscribe = value.subscribe(next => apply(next), true);
	return () => {
		unsubscribe();
		if (property.startsWith('--')) {
			if (previous === '') element.style.removeProperty(property);
			else element.style.setProperty(property, previous);
		} else {
			(element.style as unknown as Record<string, string>)[property] = previous;
		}
	};
}
