/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'misskey-js';

export type Content = {
	id: string;
	type: 'image' | 'video' | 'audio';
	url: string;
	thumbnailUrl?: string | null;
	width?: number | null;
	height?: number | null;
	filename?: string | null;
	file?: Misskey.entities.DriveFile;
	sourceElement?: HTMLElement | null;
};
