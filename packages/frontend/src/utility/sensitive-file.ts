/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

export function shouldHideFileByDefault(file: Misskey.entities.DriveFile, ignoreDataSaver = false): boolean {
	const nsfw = prefer.r.nsfw.value;
	const dataSaverMedia = prefer.r.dataSaver.value.media;

	if (nsfw === 'force' || (!ignoreDataSaver && dataSaverMedia)) {
		return true;
	}

	if (file.isSensitive && nsfw !== 'ignore') {
		return true;
	}

	return false;
}

/**
 * Keep a media component's initial visibility in sync with the user's media
 * display preferences. The preference manager exposes both a static snapshot
 * (`prefer.s`) and reactive refs (`prefer.r`); components must subscribe to
 * the latter so changing the setting affects already-mounted media too.
 */
export function useSensitiveFileVisibility(
	file: MaybeRefOrGetter<Misskey.entities.DriveFile>,
	options: { ignoreDataSaver?: boolean; forceShow?: MaybeRefOrGetter<boolean> } = {},
): Ref<boolean> {
	const hide = ref(true);

	watch([
		() => toValue(file),
		() => toValue(file).isSensitive,
		...(options.forceShow ? [() => toValue(options.forceShow!)] : []),
		prefer.r.nsfw,
		...(options.ignoreDataSaver ? [] : [() => prefer.r.dataSaver.value.media]),
	], () => {
		hide.value = options.forceShow && toValue(options.forceShow)
			? (!options.ignoreDataSaver && prefer.r.dataSaver.value.media)
			: shouldHideFileByDefault(toValue(file), options.ignoreDataSaver);
	}, { immediate: true });

	return hide;
}

export async function canRevealFile(file: Misskey.entities.DriveFile): Promise<boolean> {
	if (file.isSensitive && prefer.s.confirmWhenRevealingSensitiveMedia) {
		const { canceled } = await os.confirm({
			type: 'question',
			text: i18n.ts.sensitiveMediaRevealConfirm,
		});
		if (canceled) return false;
	}

	return true;
}
