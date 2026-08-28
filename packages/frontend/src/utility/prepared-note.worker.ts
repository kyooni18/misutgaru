/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';

type Request = {
	readonly type: 'prepare';
	readonly epoch: number;
	readonly notes: ReadonlyArray<{ readonly id: string; readonly text: string }>;
};

self.addEventListener('message', (event: MessageEvent<Request>) => {
	if (event.data?.type !== 'prepare') return;
	const notes = event.data.notes.map(note => {
		const parsed = mfm.parse(note.text);
		return {
			id: note.id,
			text: note.text,
			parsed,
			urls: extractUrlFromMfm(parsed),
		};
	});
	self.postMessage({ type: 'prepared', epoch: event.data.epoch, notes });
});
