/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Renderer-neutral host primitives for the small set of web semantics that do
 * not yet have first-class Vune Views. Keep this surface deliberately closed:
 * feature Views should not be able to manufacture arbitrary host tags by
 * passing unchecked strings through the Vune graph.
 */
import { viewElement } from 'vune-ui';
import type { ModifiableViewNode, ViewGraphChild } from 'vune-ui';

export type NativeHtmlTag =
	| 'canvas'
	| 'rt'
	| 'ruby'
	| 'del'
	| 'br'
	| 'strong'
	| 'pre'
	| 'h6'
	| 'h5'
	| 'h4'
	| 'h3'
	| 'h2'
	| 'h1'
	| 'code'
	| 'article'
	| 'b'
	| 'datalist'
	| 'div'
	| 'footer'
	| 'form'
	| 'header'
	| 'hr'
	| 'i'
	| 'img'
	| 'label'
	| 'option'
	| 'optgroup'
	| 'p'
	| 'select'
	| 'section'
	| 'small'
	| 'span'
	| 'time';

export type NativeSvgTag =
	| 'circle'
	| 'defs'
	| 'g'
	| 'linearGradient'
	| 'mask'
	| 'path'
	| 'polygon'
	| 'polyline'
	| 'rect'
	| 'stop'
	| 'svg'
	| 'text'
	| 'title'
	| 'tspan';

export type NativeHostProps = Readonly<Record<string, unknown>>;
export type NativeButtonProps = NativeHostProps & {
	type?: 'button' | 'reset' | 'submit';
	disabled?: boolean;
	onClick?: (event: PointerEvent) => void;
};

export type NativeAnchorProps = NativeHostProps & {
	href: string;
	download?: string | boolean;
	rel?: string;
	target?: string;
	title?: string;
};

function hostElement(
	tag: NativeHtmlTag | NativeSvgTag | 'a' | 'button',
	props: NativeHostProps | null,
	children: readonly ViewGraphChild[],
): ModifiableViewNode {
	return viewElement(tag, props, [...children]);
}

export function htmlElement(
	tag: NativeHtmlTag,
	props: NativeHostProps | null = null,
	...children: ViewGraphChild[]
): ModifiableViewNode {
	return hostElement(tag, props, children);
}

export function svgElement(
	tag: NativeSvgTag,
	props: NativeHostProps | null = null,
	...children: ViewGraphChild[]
): ModifiableViewNode {
	return hostElement(tag, props, children);
}

export function buttonElement(
	props: NativeButtonProps,
	...children: ViewGraphChild[]
): ModifiableViewNode {
	return hostElement('button', props, children);
}

export function anchorElement(
	props: NativeAnchorProps,
	...children: ViewGraphChild[]
): ModifiableViewNode {
	return hostElement('a', props, children);
}
