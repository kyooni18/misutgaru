/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Small renderer-neutral host primitive for semantics that do not yet have a
 * first-class Vune view (currently SVG and anchor elements). Feature views
 * should prefer the built-in Vune primitives; this helper keeps the low-level
 * escape hatch in one platform module instead of leaking raw host construction into them.
 */
import { viewElement } from 'vune-ui';
import type { ModifiableViewNode, ViewGraphChild } from 'vune-ui';

export function nativeElement(
	tag: string,
	props: Record<string, unknown> | null = null,
	...children: ViewGraphChild[]
): ModifiableViewNode {
	return viewElement(tag, props, children);
}
