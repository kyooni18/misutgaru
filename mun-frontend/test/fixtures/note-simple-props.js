/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from '../../src/services/misskey-api.mjs';

// The page under test sets window.fixtureNote before this module loads.
export const note = window.fixtureNote ?? null;
export const labels = {
  deletedNote: 'Deleted note', cwShow: 'Show content', cwHide: 'Hide', poll: 'Poll',
  quote: 'Quote', renotedBy: name => `Renoted by ${name}`, cwChars: n => `${n} characters`, cwFiles: n => `${n} file(s)`,
};
export const formatTime = () => '1m ago';
labels.error = 'Error'; labels.retry = 'Retry'; labels.noNotes = 'No notes'; labels.more = 'Load more';
export const api = createMisskeyApi({ apiUrl: '/api', getAccount: () => null });
