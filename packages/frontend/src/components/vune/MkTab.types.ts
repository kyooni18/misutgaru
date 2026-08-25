/* SPDX-License-Identifier: AGPL-3.0-only */

export type Tab<T = string> = {
	key: T;
	icon?: string;
	label?: string;
};

export type TabKey = string | number;
export type RuntimeTab = Tab<TabKey>;
export type TabSelectionAction = (key: TabKey) => void;

export function ignoreTabSelection(_key: TabKey): void {}
