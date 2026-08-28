/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';
import type * as Misskey from 'misskey-js';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';

type NoteLike = Pick<Misskey.entities.Note, 'id' | 'text'>;

export interface PreparedNoteText {
	readonly id: string;
	readonly text: string | null;
	readonly parsed: mfm.MfmNode[] | null;
	readonly urls: readonly string[];
}

type WorkerRequest = {
	readonly type: 'prepare';
	readonly epoch: number;
	readonly notes: ReadonlyArray<{ readonly id: string; readonly text: string }>;
};

type WorkerResponse = {
	readonly type: 'prepared';
	readonly epoch: number;
	readonly notes: ReadonlyArray<{ readonly id: string; readonly text: string; readonly parsed: mfm.MfmNode[]; readonly urls: string[] }>;
};

const MAX_ENTRIES = 768;
const cache = new Map<string, PreparedNoteText>();
let cacheEpoch = 0;
let worker: Worker | null | undefined;
let workerFailed = false;
const pendingWorkerTexts = new Map<string, string>();

function touch(id: string, value: PreparedNoteText): PreparedNoteText {
	cache.delete(id);
	cache.set(id, value);
	while (cache.size > MAX_ENTRIES) {
		const oldest = cache.keys().next().value as string | undefined;
		if (oldest == null) break;
		cache.delete(oldest);
	}
	return value;
}

function fromCache(note: NoteLike): PreparedNoteText | undefined {
	const cached = cache.get(note.id);
	if (!cached) return undefined;
	if (cached.text !== note.text) {
		// Do not keep an old revision around while a newer revision is being
		// prepared off-thread. This also lets the matching worker response replace
		// the old value without mistaking it for a newer synchronous parse.
		cache.delete(note.id);
		return undefined;
	}
	return touch(note.id, cached);
}

export function prepareNoteText(note: NoteLike): PreparedNoteText {
	const cached = fromCache(note);
	if (cached) return cached;
	const parsed = note.text ? mfm.parse(note.text) : null;
	return touch(note.id, {
		id: note.id,
		text: note.text,
		parsed,
		urls: parsed ? extractUrlFromMfm(parsed) : [],
	});
}

function preparedWorker(): Worker | null {
	if (worker !== undefined) return worker;
	if (workerFailed || typeof Worker === 'undefined') return (worker = null);
	try {
		worker = new Worker(new URL('./prepared-note.worker.ts', import.meta.url), {
			type: 'module',
			name: 'misutgaru-note-preparation',
		});
		worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
			if (event.data?.type !== 'prepared' || event.data.epoch !== cacheEpoch) return;
			for (const item of event.data.notes) {
				const pendingText = pendingWorkerTexts.get(item.id);
				if (pendingText === item.text) pendingWorkerTexts.delete(item.id);
				else if (pendingText !== undefined) continue;
				const current = cache.get(item.id);
				if (current && current.text !== item.text) continue;
				touch(item.id, {
					id: item.id,
					text: item.text,
					parsed: item.parsed,
					urls: item.urls,
				});
			}
		});
		worker.addEventListener('error', () => {
			workerFailed = true;
			pendingWorkerTexts.clear();
			worker?.terminate();
			worker = null;
		}, { once: true });
		return worker;
	} catch {
		workerFailed = true;
		return (worker = null);
	}
}

/**
 * Best-effort off-main-thread preparation for notes that are likely to enter
 * the viewport soon. Rendering stays synchronous: a cache miss simply falls
 * back to prepareNoteText on the caller thread, preserving existing semantics.
 */
export function prefetchPreparedNotes(notes: readonly NoteLike[], limit = 96): void {
	const target = preparedWorker();
	if (!target) return;
	const pending: Array<{ id: string; text: string }> = [];
	for (const note of notes) {
		if (pending.length >= limit) break;
		if (!note.text || fromCache(note)) continue;
		if (pendingWorkerTexts.get(note.id) === note.text) continue;
		pending.push({ id: note.id, text: note.text });
		pendingWorkerTexts.set(note.id, note.text);
	}
	if (pending.length === 0) return;
	const request: WorkerRequest = { type: 'prepare', epoch: cacheEpoch, notes: pending };
	try {
		target.postMessage(request);
	} catch {
		for (const note of pending) pendingWorkerTexts.delete(note.id);
		workerFailed = true;
		target.terminate();
		worker = null;
	}
}

export function clearPreparedNoteCache(noteId?: string): void {
	// One global epoch is intentionally used instead of per-note tokens: clear is
	// rare, while this guarantees that no in-flight worker batch can repopulate a
	// value after an explicit invalidation. New prefetches are free to start on
	// the next epoch immediately.
	cacheEpoch += 1;
	pendingWorkerTexts.clear();
	if (noteId === undefined) cache.clear();
	else cache.delete(noteId);
}
