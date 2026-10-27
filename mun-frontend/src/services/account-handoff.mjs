/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// The adapters expose the Vue account cache, Pizzax device store, preferences,
// service-worker synchronization and unison reload without owning their UI.
export function createAccountHandoff({ fetch: fetchImpl = (...args) => globalThis.fetch(...args), apiUrl = '/api', host, storage, registry, preferences, syncServiceWorkerAccounts, reload, onAccountError = () => {} }) {
  return async function login(token, redirect) {
    const response = await fetchImpl(`${apiUrl}/i`, {
      method: 'POST', body: JSON.stringify({ i: token }), headers: { 'Content-Type': 'application/json' },
    });
    if (response.status >= 500 && response.status < 600) throw new Error(`Account request failed: ${response.status}`);
    const me = await response.json();
    if (me && typeof me === 'object' && 'error' in me) { await onAccountError(me.error); throw new Error('Unable to fetch account'); }
    if (!me || typeof me !== 'object' || Array.isArray(me) || typeof me.id !== 'string' || typeof me.username !== 'string') throw new Error('Invalid account response');
    storage.setItem('account', JSON.stringify({ ...me, token }));
    const accounts = preferences.getAccounts();
    if (!accounts.some(([accountHost, user]) => accountHost === host && user.id === me.id)) {
      const key = `${host}/${me.id}`;
      await registry.add(key, me, token);
      preferences.setAccounts([...accounts, [host, { id: me.id, username: me.username }]]);
      // Vue treats service-worker synchronization as best effort.
      void Promise.resolve().then(() => syncServiceWorkerAccounts()).catch(() => {});
    }
    await reload(redirect);
    return me;
  };
}
