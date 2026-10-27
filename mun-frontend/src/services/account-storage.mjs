/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { get, set, update } from 'idb-keyval';
import { BroadcastChannel } from 'broadcast-channel';
import { version } from '../../../package.json';

// Mirrors idb-proxy's default keyval store and its localStorage fallback.
export async function createAccountStorage({ host, storage = globalThis.localStorage, indexed = { get, set, update }, makeChannel = name => new BroadcastChannel(name), navigate = path => { if (path == null) window.location.reload(); else window.location.href = path; }, now = () => Date.now(), id = () => crypto.randomUUID() }) {
  let idbAvailable = true;
  try { await indexed.set('idb-test', 'test'); } catch { idbAvailable = false; }
  const read = async key => idbAvailable ? indexed.get(key) : JSON.parse(storage.getItem(`idbfallback::${key}`) ?? 'null');
  const write = async (key, value) => idbAvailable ? indexed.set(key, value) : storage.setItem(`idbfallback::${key}`, JSON.stringify(value));
  const updateValue = async (key, fn) => {
    if (idbAvailable) return indexed.update(key, fn);
    await write(key, fn(await read(key)));
  };
  // Pizzax migrates the old direct localStorage state when IndexedDB exists.
  if (idbAvailable && await read('pizzax::base') == null) {
    const legacy = storage.getItem('pizzax::base');
    if (legacy != null) { const value = JSON.parse(legacy); await indexed.set('pizzax::base', value); storage.removeItem('pizzax::base'); }
  }
  let profile;
  const rawProfile = storage.getItem('preferences');
  if (rawProfile != null) {
    profile = JSON.parse(rawProfile);
    if (!profile || profile.type !== 'main' || typeof profile.id !== 'string' || typeof profile.version !== 'string' || typeof profile.modifiedAt !== 'number' || typeof profile.name !== 'string' || !profile.preferences || typeof profile.preferences !== 'object' || Array.isArray(profile.preferences)) throw new Error('Invalid preferences profile');
  } else profile = { id: id(), version, type: 'main', modifiedAt: now(), name: '', preferences: {} };
  let currentAccount = null;
  try { currentAccount = JSON.parse(storage.getItem('account') ?? 'null'); } catch { /* Match the guest preference scope for malformed cache. */ }
  const records = profile.preferences.accounts ?? [[{}, [], {}]];
  if (!Array.isArray(records) || !records.every(r => Array.isArray(r) && r.length >= 2 && r[0] && typeof r[0] === 'object' && Array.isArray(r[1]))) throw new Error('Invalid accounts preferences');
  profile.preferences.accounts = records;
  const matching = currentAccount?.id ? records.find(([s]) => s.server === host && s.account === currentAccount.id) ?? records.find(([s]) => s.server === host && s.account == null) : null;
  const selected = matching ?? records.find(([s]) => s.account == null);
  if (!selected) throw new Error('Missing accounts preference scope');
  let lastTokens = null;
  return {
    storage,
    preferences: {
      getAccounts: () => selected[1],
      setAccounts(accounts) {
        selected[1] = accounts; profile.modifiedAt = now(); profile.version = version;
        storage.setItem('preferences', JSON.stringify(profile));
        const channel = makeChannel('preferences');
        void Promise.resolve(channel.postMessage({ type: 'preferencesUpdate', tabId: id(), timestamp: profile.modifiedAt })).catch(() => {}).finally(() => channel.close());
      },
    },
    registry: {
      async add(key, me, token) {
        await updateValue('pizzax::base', state => {
          const next = { ...(state ?? {}) };
          next.accountTokens = { ...(next.accountTokens ?? {}), [key]: token };
          next.accountInfos = { ...(next.accountInfos ?? {}), [key]: me };
          lastTokens = next.accountTokens;
          return next;
        });
      },
    },
    async syncServiceWorkerAccounts() {
      const tokens = lastTokens ?? (await read('pizzax::base'))?.accountTokens ?? {};
      const prefix = `${host}/`;
      await write('accounts', Object.entries(tokens).filter(([key]) => key.startsWith(prefix)).map(([key, token]) => ({ id: key.slice(prefix.length), token })));
    },
    async reload(path) {
      const channel = makeChannel('reload');
      try { await channel.postMessage(null); } finally { await channel.close(); }
      navigate(path);
    },
  };
}
