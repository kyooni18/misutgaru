/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import { prefer } from '@/preferences.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';
import { shouldHideFileByDefault } from '@/utility/sensitive-file.js';

const MAX_TRACKED_URLS = 256;
const prefetchedUrls = new Set<string>();
const inFlight = new Map<string, HTMLImageElement>();

function displayedMediaUrl(file: Misskey.entities.DriveFile): string | null {
	if (file.type.startsWith('video/')) return file.thumbnailUrl ?? null;
	if (!file.type.startsWith('image/')) return null;
	if (prefer.s.loadRawImages) return file.url;
	if (prefer.s.disableShowingAnimatedImages) return getStaticImageUrl(file.url);
	return file.thumbnailUrl ?? file.url;
}

function remember(url: string): void {
	prefetchedUrls.add(url);
	while (prefetchedUrls.size > MAX_TRACKED_URLS) {
		const oldest = prefetchedUrls.values().next().value as string | undefined;
		if (oldest == null) break;
		prefetchedUrls.delete(oldest);
	}
}

function prefetchImage(url: string): boolean {
	if (prefetchedUrls.has(url) || inFlight.has(url)) return false;
	if (typeof window === 'undefined' || typeof window.Image === 'undefined') return false;

	const image = new window.Image();
	image.loading = 'eager';
	image.decoding = 'async';
	image.fetchPriority = 'high';
	inFlight.set(url, image);

	image.addEventListener('load', () => {
		inFlight.delete(url);
		remember(url);
	}, { once: true });
	image.addEventListener('error', () => {
		inFlight.delete(url);
	}, { once: true });
	image.src = url;
	return true;
}

/**
 * Eagerly warm all media belonging to notes that are already loaded by the
 * timeline, including rows that have not been mounted by virtualization yet.
 * This is deliberately client-only and never fetches sensitive/CW media that
 * the current UI would keep hidden.
 */
export function prefetchNoteMedia(notes: readonly Misskey.entities.Note[]): void {
	if (prefer.s.dataSaver.media) return;

	for (const note of notes) {
		if (note.cw != null && !prefer.s.showCwMedia) continue;

		for (const file of note.files ?? []) {
			if (shouldHideFileByDefault(file)) continue;
			const url = displayedMediaUrl(file);
			if (url == null) continue;
			prefetchImage(url);
		}
	}
}

