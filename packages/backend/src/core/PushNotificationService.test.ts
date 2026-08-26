/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { Packed } from '@/misc/json-schema.js';
import { truncateBody } from '@/core/PushNotificationService.js';

describe('truncateBody', () => {
	test('keeps only the note fields needed by a push notification', () => {
		const note = {
			id: '9z4w8v5j3x',
			createdAt: '2026-08-26T00:00:00.000Z',
			visibility: 'public',
		text: 'A note',
			files: [{ id: 'large-file' }],
			reactions: { heart: 1 },
		} as unknown as Packed<'Note'>;
		const body = {
			type: 'mention',
			note,
			user: { id: 'user-id' },
		} as unknown as Packed<'Notification'>;

		const compact = truncateBody('notification', body);
		expect(compact.note).toMatchObject({
			id: note.id,
			createdAt: note.createdAt,
			visibility: note.visibility,
		});
		expect(compact.note.text).toContain(note.text);
		expect(compact.note).not.toHaveProperty('files');
		expect(compact.note).not.toHaveProperty('reactions');
		expect(compact.note).not.toHaveProperty('user');
	});

	test('limits chat text to keep the encrypted payload small', () => {
		const body = {
			id: '9z4w8v5j3y',
			createdAt: '2026-08-26T00:00:00.000Z',
			fromUserId: 'user-id',
			fromUser: {
				id: 'user-id',
				name: 'Sender',
				username: 'sender',
				host: null,
				avatarUrl: 'https://example.test/avatar.png',
			},
			toUserId: 'recipient-id',
			text: 'x'.repeat(2048),
			file: { id: 'large-file' },
			reactions: [{ reaction: '❤️', user: { id: 'other-user' } }],
		} as unknown as Packed<'ChatMessage'>;

		const compact = truncateBody('newChatMessage', body);
		expect(compact.text).toHaveLength(1024);
		expect(compact.fromUser).toMatchObject({ id: 'user-id', username: 'sender' });
		expect(compact).not.toHaveProperty('file');
		expect(compact).not.toHaveProperty('reactions');
	});

	test('limits app notification text', () => {
		const body = {
			type: 'app',
			header: 'h'.repeat(512),
			body: 'b'.repeat(2048),
			icon: 'https://example.test/icon.png',
		} as unknown as Packed<'Notification'>;

		const compact = truncateBody('notification', body);
		expect(compact.header).toHaveLength(256);
		expect(compact.body).toHaveLength(1024);
	});
});
