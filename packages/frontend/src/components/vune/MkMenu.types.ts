/* SPDX-License-Identifier: AGPL-3.0-only */
import type { ViewGraphValue } from 'vune-ui';
import type { Material } from '@/vune/material.js';

export type NativeMenuRowKind = 'divider' | 'label' | 'pending' | 'component' | 'link' | 'external' | 'button' | 'switch' | 'parent' | 'radio';

export type NativeMenuRow = {
	key: string;
	kind: NativeMenuRowKind;
	text?: string;
	caption?: string;
	icon?: string;
	className?: string[];
	iconClass?: string;
	avatarClass?: string;
	contentClass?: string;
	textClass?: string[];
	titleClass?: string;
	captionClass?: string;
	caretClass?: string;
	indicatorClass?: string;
	radioIconClass?: string[];
	switchClass?: string[];
	href?: string;
	target?: string;
	download?: string;
	active?: boolean;
	danger?: boolean;
	disabled?: boolean;
	indicate?: boolean;
	checked?: boolean;
	content?: ViewGraphValue;
	leading?: ViewGraphValue;
	onActivate?: (event: PointerEvent) => void;
	onHover?: (event: MouseEvent) => void;
	onMove?: (event: MouseEvent) => void;
	onLeave?: () => void;
};

export type NativeMenuModel = {
	rows: NativeMenuRow[];
	material: Material;
	animated: boolean;
	menuClass: string;
	surfaceClass: string;
	itemClass: string;
	noneLabel: string;
	width?: number;
	maxHeight?: number;
	asDrawer: boolean;
	big: boolean;
	center: boolean;
	guardClass: string[];
	guardClipPath: string;
	guardTop: number;
	onItemsRef?: (element: HTMLElement | null) => void;
	onKeydown?: (event: KeyboardEvent) => void;
	onMouseMove?: (event: MouseEvent) => void;
	onMouseLeave?: () => void;
	onGuardMouseMove?: (event: MouseEvent) => void;
};
