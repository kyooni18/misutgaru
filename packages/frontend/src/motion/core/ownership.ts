/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface MotionPropertyOwner {
	replaceByNewOwner(): void;
}

const ownership = new WeakMap<Element, Map<string, MotionPropertyOwner>>();

export function claimMotionProperties(element: Element, properties: readonly string[], owner: MotionPropertyOwner): void {
	let elementOwners = ownership.get(element);
	if (elementOwners == null) {
		elementOwners = new Map();
		ownership.set(element, elementOwners);
	}

	const replaced = new Set<MotionPropertyOwner>();
	for (const property of properties) {
		const current = elementOwners.get(property);
		if (current != null && current !== owner) replaced.add(current);
	}
	for (const current of replaced) current.replaceByNewOwner();
	for (const property of properties) elementOwners.set(property, owner);
}

export function releaseMotionProperties(element: Element, properties: readonly string[], owner: MotionPropertyOwner): void {
	const elementOwners = ownership.get(element);
	if (elementOwners == null) return;
	for (const property of properties) {
		if (elementOwners.get(property) === owner) elementOwners.delete(property);
	}
	if (elementOwners.size === 0) ownership.delete(element);
}
