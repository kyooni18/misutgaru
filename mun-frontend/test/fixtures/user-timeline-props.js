/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { labels, formatTime, api, services } from './note-simple-props.js';
export const userLabels = { ...labels, tabs: { featured: 'Featured', notes: 'Notes', all: 'All', files: 'With files' } };
export { formatTime, api, services };
