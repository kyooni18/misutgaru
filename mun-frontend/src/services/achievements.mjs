/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Vue marks claims immediately and staggers API requests by 500 ms. Keep one
// claimer per signed-in session so separate components share deduplication.
export function createAchievementClaimer({ account, api, setTimeout: schedule = globalThis.setTimeout, reportError = console.error }) {
  const claimed = new Set(account?.achievements?.map(achievement => achievement.name) ?? []);
  const queue = new Set();
  return async function claimAchievement(name) {
    if (account == null || account.movedTo || claimed.has(name)) return;
    queue.add(name);
    claimed.add(name);
    await new Promise(resolve => schedule(resolve, (queue.size - 1) * 500));
    schedule(() => queue.delete(name), 500);
    try { Promise.resolve(api('i/claim-achievement', { name })).catch(reportError); } catch (error) { reportError(error); }
  };
}
