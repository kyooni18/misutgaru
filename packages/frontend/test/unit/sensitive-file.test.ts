/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test } from 'vitest';
import { effectScope, nextTick, type Ref } from 'vue';
import type * as Misskey from 'misskey-js';
import { prefer } from '@/preferences.js';
import { useSensitiveFileVisibility } from '@/utility/sensitive-file.js';

const sensitiveFile = {
	id: 'xxxxxxxx',
	isSensitive: true,
	name: 'sensitive.png',
	type: 'image/png',
} as Misskey.entities.DriveFile;

const nsfw = prefer.r.nsfw as Ref<'respect' | 'force' | 'ignore'>;

afterEach(() => {
	prefer.s.nsfw = 'respect';
	nsfw.value = 'respect';
	prefer.s.dataSaver.media = false;
	prefer.r.dataSaver.value = { ...prefer.r.dataSaver.value, media: false };
});

describe('useSensitiveFileVisibility', () => {
	test('updates mounted media when sensitive-media display is set to show', async () => {
		prefer.s.nsfw = 'respect';
		nsfw.value = 'respect';
		const scope = effectScope();
		const hide = scope.run(() => useSensitiveFileVisibility(sensitiveFile))!;

		assert.isTrue(hide.value);

		nsfw.value = 'ignore';
		await nextTick();

		assert.isFalse(hide.value);
		scope.stop();
	});

	test('keeps data-saver media hidden even when sensitive labels are ignored', async () => {
		prefer.s.nsfw = 'ignore';
		nsfw.value = 'ignore';
		prefer.s.dataSaver.media = true;
		prefer.r.dataSaver.value = { ...prefer.r.dataSaver.value, media: true };
		const scope = effectScope();
		const hide = scope.run(() => useSensitiveFileVisibility(sensitiveFile))!;

		assert.isTrue(hide.value);

		prefer.s.dataSaver.media = false;
		prefer.r.dataSaver.value = { ...prefer.r.dataSaver.value, media: false };
		await nextTick();

		assert.isFalse(hide.value);
		scope.stop();
	});

	test('force-shows media in a CW-only media slot', () => {
		prefer.s.nsfw = 'respect';
		nsfw.value = 'respect';
		const scope = effectScope();
		const hide = scope.run(() => useSensitiveFileVisibility(sensitiveFile, { forceShow: true }))!;

		assert.isFalse(hide.value);
		scope.stop();
	});
});
