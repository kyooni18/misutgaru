/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Match the Vue boot path: read the current account once from the same key,
// treating malformed or non-object cache entries as a signed-out session.
export function readCachedAccount(getStorage = () => globalThis.localStorage, warn = console.warn) {
  let raw;
  try {
    raw = getStorage()?.getItem('account') ?? null;
  } catch (error) {
    warn('[localStorage] Persistent storage is unavailable; using a signed-out session for this tab', error);
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value != null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    warn('[account] Ignoring invalid cached account data');
    return null;
  }
}
