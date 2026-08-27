/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type Keys = (
	'v' |
	'lastVersion' |
	'instance' |
	'instanceCachedAt' |
	'account' |
	'latestDonationInfoShownAt' |
	'neverShowDonationInfo' |
	'neverShowLocalOnlyInfo' |
	'modifiedVersionMustProminentlyOfferInAgplV3Section13Read' |
	'lastUsed' |
	'lang' |
	'drafts' |
	'hashtags' |
	'colorScheme' |
	'useSystemFont' |
	'fontSize' |
	'ui' |
	'ui_temp' |
	'bootloaderLocales' |
	'theme' |
	'themeId' |
	'themeCachedVersion' |
	'customCss' |
	'chatMessageDrafts' |
	'scratchpad' |
	'debug' |
	'preferences' |
	'latestPreferencesUpdate' |
	'hidePreferencesRestoreSuggestion' |
	'isSafeMode' |
	`miux:${string}` |
	`ui:folder:${string}` |
	`themes:${string}` | // DEPRECATED
	`aiscript:${string}` |
	'lastEmojisFetchedAt' | // DEPRECATED, stored in indexeddb (13.9.0~)
	'emojis' | // DEPRECATED, stored in indexeddb (13.9.0~);
	`channelLastReadedAt:${string}` |
	`idbfallback::${string}`
);

// localStorage が利用できない環境でも、少なくとも現在のタブは動作を継続できるようにする。
const safeSessionStorage = new Map<Keys, string>();
let storageWarningShown = false;

function warnStorageUnavailable(error: unknown) {
	if (storageWarningShown) return;
	storageWarningShown = true;
	console.warn('[localStorage] Persistent storage is unavailable; falling back to in-memory storage for this tab', error);
}

export const miLocalStorage = {
	getItem: (key: Keys): string | null => {
		if (safeSessionStorage.has(key)) return safeSessionStorage.get(key) ?? null;
		try {
			return window.localStorage.getItem(key);
		} catch (error) {
			warnStorageUnavailable(error);
			return null;
		}
	},
	setItem: (key: Keys, value: string): void => {
		try {
			window.localStorage.setItem(key, value);
			safeSessionStorage.delete(key);
		} catch (error) {
			warnStorageUnavailable(error);
			safeSessionStorage.set(key, value);
		}
	},
	removeItem: (key: Keys): void => {
		safeSessionStorage.delete(key);
		try {
			window.localStorage.removeItem(key);
		} catch (error) {
			warnStorageUnavailable(error);
		}
	},
	getItemAsJson: (key: Keys): any | undefined => {
		const item = miLocalStorage.getItem(key);
		if (item === null) {
			return undefined;
		}
		return JSON.parse(item);
	},
	setItemAsJson: (key: Keys, value: any): void => {
		miLocalStorage.setItem(key, JSON.stringify(value));
	},
};
