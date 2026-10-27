/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Read only the preferences used by the follow flow. Cloud synchronization and
// preference editing belong to the eventual native preferences manager.
export function createFollowPreferences({ host, account, prefersReducedMotion = false, getStorage = () => globalThis.localStorage }) {
  const defaults = { alwaysConfirmFollow: true, defaultFollowWithReplies: false, animation: !prefersReducedMotion };
  let preferences = {};
  function reload() {
    try {
      const profile = JSON.parse(getStorage()?.getItem('preferences') ?? 'null');
      if (profile && typeof profile === 'object' && !Array.isArray(profile) && profile.type === 'main' &&
        typeof profile.id === 'string' && typeof profile.version === 'string' &&
        typeof profile.modifiedAt === 'number' && Number.isFinite(profile.modifiedAt) &&
        typeof profile.name === 'string' && profile.preferences &&
        typeof profile.preferences === 'object' && !Array.isArray(profile.preferences)) {
        preferences = profile.preferences;
      } else preferences = {};
    } catch { preferences = {}; }
  }
  function read() {
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
      const records = preferences[key];
      if (records == null || records.length === 0) return [key, fallback];
      const match = account == null ? undefined :
        records.find(([scope]) => scope.server === host && scope.account === account.id) ??
        records.find(([scope]) => scope.server === host && scope.account == null);
      const record = match ?? records.find(([scope]) => scope.account == null);
      if (!record) throw new Error(`no record found for key: ${key}`);
      return [key, record[1]];
    }));
  }
  reload();
  return { read, reload };
}
