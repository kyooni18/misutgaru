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

// Refresh the in-memory object in place, retaining the cached token as Vue
// does. Invalid-account handling is returned to the caller: removing or
// switching accounts requires the native account manager and UI.
export async function refreshCachedAccount(account, {
  apiUrl = '/api', fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  getStorage = () => globalThis.localStorage, warn = console.warn,
} = {}) {
  if (!account?.token) return { status: 'signed-out' };
  const token = account.token;
  try {
    const response = await fetchImpl(`${apiUrl}/i`, {
      method: 'POST', body: JSON.stringify({ i: token }), headers: { 'Content-Type': 'application/json' },
    });
    if (response.status >= 500 && response.status < 600) return { status: 'unavailable' };
    const result = await response.json();
    // Ignore every result from an older account, including authentication errors.
    if (account.token !== token) return { status: 'stale' };
    if (result && typeof result === 'object' && 'error' in result) return { status: 'invalid', error: result.error };
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { status: 'unavailable' };
    for (const key of Object.keys(account)) delete account[key];
    Object.assign(account, result, { token });
    try {
      getStorage()?.setItem('account', JSON.stringify(account));
    } catch {
      warn('[localStorage] Persistent storage is unavailable; keeping the refreshed account in memory');
    }
    return { status: 'updated' };
  } catch {
    return { status: 'unavailable' };
  }
}
