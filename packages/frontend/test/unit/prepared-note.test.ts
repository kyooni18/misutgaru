/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('prepared note cache', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
	});

	test('reuses parsed text and URLs for the same note revision', async () => {
		const { prepareNoteText, clearPreparedNoteCache } = await import('@/utility/prepared-note.js');
		clearPreparedNoteCache();
		const note = { id: 'note-1', text: 'https://example.com' } as const;
		const first = prepareNoteText(note);
		const second = prepareNoteText(note);
		expect(second).toBe(first);
		expect(first.parsed).not.toBeNull();
		expect(first.urls).toContain('https://example.com');
	});

	test('a text revision replaces the cached AST instead of reusing stale output', async () => {
		const { prepareNoteText, clearPreparedNoteCache } = await import('@/utility/prepared-note.js');
		clearPreparedNoteCache();
		const first = prepareNoteText({ id: 'note-1', text: 'first' });
		const second = prepareNoteText({ id: 'note-1', text: 'second' });
		expect(second).not.toBe(first);
		expect(second.text).toBe('second');
	});

	test('targeted eviction drops only the deleted note revision', async () => {
		const { prepareNoteText, clearPreparedNoteCache } = await import('@/utility/prepared-note.js');
		clearPreparedNoteCache();
		const first = prepareNoteText({ id: 'note-1', text: 'one' });
		const sibling = prepareNoteText({ id: 'note-2', text: 'two' });
		clearPreparedNoteCache('note-1');
		expect(prepareNoteText({ id: 'note-1', text: 'one' })).not.toBe(first);
		expect(prepareNoteText({ id: 'note-2', text: 'two' })).toBe(sibling);
	});

	test('prefetch coalesces the same revision while a Worker batch is pending', async () => {
		class FakeWorker {
			static latest: FakeWorker | undefined;
			readonly posted: unknown[] = [];
			readonly listeners = new Map<string, Array<(event: unknown) => void>>();
			constructor() { FakeWorker.latest = this; }
			addEventListener(type: string, listener: (event: unknown) => void): void {
				const values = this.listeners.get(type) ?? [];
				values.push(listener);
				this.listeners.set(type, values);
			}
			postMessage(value: unknown): void { this.posted.push(value); }
			terminate(): void {}
		}
		vi.stubGlobal('Worker', FakeWorker);
		const { prefetchPreparedNotes, clearPreparedNoteCache } = await import('@/utility/prepared-note.js');
		clearPreparedNoteCache();
		const note = { id: 'note-1', text: 'hello' } as const;
		prefetchPreparedNotes([note]);
		prefetchPreparedNotes([note]);
		expect(FakeWorker.latest?.posted).toHaveLength(1);
	});
});
