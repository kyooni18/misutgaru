/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Framework-independent copy of packages/frontend/src/utility/timeline-date-separate.ts.
export function getDateText(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function dateInfo(value) {
  const date = new Date(value);
  return { date, dayKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, text: getDateText(date) };
}

export function isSeparatorNeeded(prev, next) {
  if (prev == null || next == null) return false;
  return dateInfo(prev).dayKey !== dateInfo(next).dayKey;
}

export function getSeparatorInfo(prev, next) {
  if (prev == null || next == null) return null;
  return { prevText: dateInfo(prev).text, nextText: dateInfo(next).text };
}

// Pairs each note with the separator shown above it, as MkNotesTimeline does.
export function withSeparators(notes) {
  return notes.map((note, i) => ({
    id: note.id,
    note,
    separator: i > 0 && isSeparatorNeeded(notes[i - 1].createdAt, note.createdAt) ? getSeparatorInfo(notes[i - 1].createdAt, note.createdAt) : null,
  }));
}
