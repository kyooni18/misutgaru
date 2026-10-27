/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Read only the preferences used by the follow flow; editing and persistence
// of cloud results belong to the eventual native preferences manager.
export function createFollowPreferences({ host, account, prefersReducedMotion = false, getStorage = () => globalThis.localStorage }) {
  const defaults = { alwaysConfirmFollow: true, defaultFollowWithReplies: false, animation: !prefersReducedMotion, 'experimental.enableHapticFeedback': false };
  let preferences = {};
  let generation = 0;
  function reload() {
    generation++;
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
  function matchedRecord(key) {
    const records = preferences[key];
    if (records == null || records.length === 0) return null;
    const match = account == null ? undefined :
      records.find(([scope]) => scope.server === host && scope.account === account.id) ??
      records.find(([scope]) => scope.server === host && scope.account == null);
    const record = match ?? records.find(([scope]) => scope.account == null);
    if (!record) throw new Error(`no record found for key: ${key}`);
    return record;
  }
  function read() {
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
      const record = matchedRecord(key);
      return [key, record == null ? fallback : record[1]];
    }));
  }
  async function sync(api) {
    const started = generation;
    const records = Object.keys(defaults).map(key => [key, matchedRecord(key)]).filter(([, record]) => record?.[2]?.sync);
    const values = await Promise.all(records.map(async ([key, record]) => {
      try {
        const entries = await api('i/registry/get', { scope: ['client', 'preferences', 'sync'], key: `default:${key}` });
        const target = entries.find(([scope]) => ['server', 'account', 'device'].every(field => (scope[field] ?? null) === (record[0][field] ?? null)));
        return target?.[1];
      } catch (error) {
        if (error?.code === 'NO_SUCH_KEY') return undefined;
        throw error;
      }
    }));
    if (started !== generation) return;
    records.forEach(([, record], index) => { if (values[index] !== undefined) record[1] = values[index]; });
  }
  reload();
  return { read, reload, sync };
}
