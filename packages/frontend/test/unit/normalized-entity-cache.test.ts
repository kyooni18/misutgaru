/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import type * as Misskey from 'misskey-js';
import { evictNormalizedNote, normalizeNoteEntity } from '@/utility/normalized-entity-cache.js';

function note(id: string, text: string, username = 'alice'): Misskey.entities.Note {
	return {
		id,
		createdAt: '2026-08-28T00:00:00.000Z',
		userId: 'user-1',
		user: {
			id: 'user-1', username, name: username, host: null,
			avatarUrl: null, avatarBlurhash: null, isBot: false, isCat: false,
			emojis: {}, onlineStatus: 'unknown', badgeRoles: [],
		} as Misskey.entities.UserLite,
		text,
		cw: null,
		visibility: 'public',
		localOnly: false,
		reactionAcceptance: null,
		renoteCount: 0,
		repliesCount: 0,
		reactionCount: 0,
		reactions: {},
		reactionEmojis: {},
		fileIds: [], files: [],
		replyId: null, renoteId: null,
	} as unknown as Misskey.entities.Note;
}

describe('normalized note entity cache', () => {
	test('reuses one reactive identity and updates it in place', () => {
		const first = normalizeNoteEntity(note('n1', 'one'));
		const second = normalizeNoteEntity(note('n1', 'two', 'alice2'));
		expect(second).toBe(first);
		expect(first.text).toBe('two');
		expect(first.user.username).toBe('alice2');
	});

	test('eviction breaks note identity without invalidating reusable nested users', () => {
		const first = normalizeNoteEntity(note('n2', 'one'));
		evictNormalizedNote('n2');
		const second = normalizeNoteEntity(note('n2', 'two'));
		expect(second).not.toBe(first);
		expect(second.user).toBe(first.user);
	});

	test('keeps the files array identity when an update resolves to the same canonical files', () => {
		const firstInput = note('n3', 'one') as Misskey.entities.Note & { files: Misskey.entities.DriveFile[] };
		const file = {
			id: 'file-1', createdAt: '2026-08-28T00:00:00.000Z', name: 'one.png', type: 'image/png', md5: 'x', size: 1,
			isSensitive: false, blurhash: null, properties: {}, url: 'https://example.test/one.png', thumbnailUrl: null, comment: null, folderId: null, folder: null,
		} as unknown as Misskey.entities.DriveFile;
		firstInput.files = [file];
		firstInput.fileIds = [file.id];
		const first = normalizeNoteEntity(firstInput);
		const files = first.files;
		const secondInput = note('n3', 'two') as typeof firstInput;
		secondInput.files = [{ ...file }];
		secondInput.fileIds = [file.id];
		const second = normalizeNoteEntity(secondInput);
		expect(second).toBe(first);
		expect(second.files).toBe(files);
		expect(second.files[0]).toBe(files[0]);
	});
});
