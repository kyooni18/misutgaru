/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// The page under test sets window.fixtureNote before this module loads.
export const note = window.fixtureNote ?? null;
export const labels = {
  deletedNote: 'Deleted note', cwShow: 'Show content', cwHide: 'Hide', poll: 'Poll',
  quote: 'Quote', renotedBy: name => `Renoted by ${name}`, cwChars: n => `${n} characters`, cwFiles: n => `${n} file(s)`,
};
export const formatTime = () => '1m ago';
