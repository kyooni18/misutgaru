/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Matches the language selection and fallback used by frontend-shared's intl-const.
export function formatVisitorNumber(value, getStorage = () => globalThis.localStorage) {
  let lang = 'en-US';
  try { lang = getStorage()?.getItem('lang') ?? lang; } catch { /* Storage can be unavailable. */ }
  try { return new Intl.NumberFormat(lang.replace('ja-KS', 'ja-JP')).format(value); }
  catch { return new Intl.NumberFormat('en-US').format(value); }
}

// MkNumber animates from zero over 500ms when each stats card is mounted.
export function animateVisitorCounts(users, notes, signal, update) {
  let frame;
  let start;
  const stop = () => cancelAnimationFrame(frame);
  const step = timestamp => {
    if (signal.aborted) return;
    if (start === undefined) start = timestamp;
    const progress = Math.min((timestamp - start) / 500, 1);
    update(formatVisitorNumber(Math.floor(users * progress)), formatVisitorNumber(Math.floor(notes * progress)));
    if (progress < 1) frame = requestAnimationFrame(step);
    else signal.removeEventListener('abort', stop);
  };
  signal.addEventListener('abort', stop, { once: true });
  frame = requestAnimationFrame(step);
}
