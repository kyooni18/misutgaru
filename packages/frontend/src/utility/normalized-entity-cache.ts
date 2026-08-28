/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { shallowReactive } from 'vue';
import type * as Misskey from 'misskey-js';

type Identified = { id: string };

class BoundedIdentityMap<T extends Identified> {
	private readonly values = new Map<string, T>();

	constructor(private readonly limit: number) {}

	public get(id: string): T | undefined {
		const value = this.values.get(id);
		if (value) {
			this.values.delete(id);
			this.values.set(id, value);
		}
		return value;
	}

	public set(value: T): T {
		this.values.delete(value.id);
		this.values.set(value.id, value);
		while (this.values.size > this.limit) {
			const oldest = this.values.keys().next().value as string | undefined;
			if (oldest == null) break;
			this.values.delete(oldest);
		}
		return value;
	}

	public delete(id: string): void {
		this.values.delete(id);
	}
}

const noteCache = new BoundedIdentityMap<Misskey.entities.Note>(4096);
const userCache = new BoundedIdentityMap<Misskey.entities.UserLite>(2048);
const fileCache = new BoundedIdentityMap<Misskey.entities.DriveFile>(4096);

function mergeCanonical<T extends Identified>(cache: BoundedIdentityMap<T>, value: T): T {
	const current = cache.get(value.id);
	if (current) {
		Object.assign(current, value);
		return current;
	}
	return cache.set(shallowReactive({ ...value }) as T);
}

function reuseReferenceArray<T>(previous: readonly T[] | undefined, next: readonly T[] | undefined): readonly T[] | undefined {
	if (!next) return next;
	if (!previous || previous.length !== next.length) return next;
	for (let i = 0; i < next.length; i++) if (previous[i] !== next[i]) return next;
	return previous;
}

export function normalizeUserEntity<T extends Misskey.entities.UserLite>(user: T): T {
	return mergeCanonical(userCache, user) as T;
}

export function normalizeDriveFileEntity<T extends Misskey.entities.DriveFile>(file: T): T {
	return mergeCanonical(fileCache, file) as T;
}

/**
 * Reuse one reactive identity for the same Note across timeline, thread and
 * modal surfaces. Top-level API refreshes update the canonical object in place,
 * so existing consumers see fresh counters/user/file references without
 * duplicating the whole entity graph.
 */
export function normalizeNoteEntity<T extends Misskey.entities.Note>(note: T, seen = new Set<string>()): T {
	const existing = noteCache.get(note.id) as T | undefined;
	if (seen.has(note.id)) return existing ?? note;
	seen.add(note.id);
	const normalizedUser = note.user ? normalizeUserEntity(note.user) : note.user;
	const normalizedFiles = note.files?.map(normalizeDriveFileEntity) ?? note.files;
	const normalizedRenote = note.renote ? normalizeNoteEntity(note.renote, seen) : note.renote;
	seen.delete(note.id);
	if (existing) {
		const previousFiles = existing.files;
		Object.assign(existing, note);
		Object.assign(existing, {
			user: normalizedUser,
			files: reuseReferenceArray(previousFiles, normalizedFiles),
			...('renote' in note ? { renote: normalizedRenote } : {}),
		});
		return existing;
	}
	const normalized = {
		...note,
		user: normalizedUser,
		files: normalizedFiles,
		...(note.renote ? { renote: normalizedRenote } : {}),
	} as T;
	return noteCache.set(shallowReactive(normalized) as T) as T;
}

export function evictNormalizedNote(id: string): void {
	noteCache.delete(id);
}
