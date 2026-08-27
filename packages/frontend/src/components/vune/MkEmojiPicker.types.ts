/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ViewGraphValue } from 'vune-ui';

export interface NativeEmojiPickerItem {
	key: string;
	disabled: boolean;
	title: string;
	view: ViewGraphValue;
}

export interface NativeEmojiPickerSection {
	key: string;
	title: string;
	count: number;
	emojis: NativeEmojiPickerItem[];
	expanded: boolean;
	onToggle: () => void;
}

export interface NativeEmojiPickerGroup {
	key: string;
	title: string;
	icon: string;
	sections: NativeEmojiPickerSection[];
}

export interface NativeEmojiPickerModel {
	query: string;
	placeholder: string;
	width: number;
	height: number;
	columns: number;
	itemSize: number;
	maxHeight?: number;
	asDrawer: boolean;
	asWindow: boolean;
	pinned: NativeEmojiPickerItem[];
	recent: NativeEmojiPickerItem[];
	results: NativeEmojiPickerItem[];
	resultLabel: string;
	groups: NativeEmojiPickerGroup[];
	onQuery: (value: string) => void;
	onPaste: (value: string) => boolean;
	onSubmit: () => void;
	onChoose: (key: string) => void;
	onSettings: () => void;
	onEscape: () => void;
}
