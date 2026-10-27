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

