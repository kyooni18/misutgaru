/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Create one adapter per component instance: channel connections are owned and
// disposed by that instance, while the Misskey Stream itself remains shared.
export function createFollowButtonServices({ host, api, stream, getAccount, getPreferences, i18n, pleaseLogin, confirm, haptic, claimAchievement, updateUser, reportError = console.error }) {
  let connection;
  const labels = {
    get processing() { return i18n.ts.processing; },
    get pending() { return i18n.ts.followRequestPending; },
    get following() { return i18n.ts.youFollowing; },
    get request() { return i18n.ts.followRequest; },
    get follow() { return i18n.ts.follow; },
  };
  return {
    host, labels, api, haptic, updateUser, reportError,
    get alwaysConfirmFollow() { return getPreferences().alwaysConfirmFollow; },
    get defaultFollowWithReplies() { return getPreferences().defaultFollowWithReplies; },
    signedIn: () => getAccount() != null,
    login: path => pleaseLogin({ openOnRemote: { type: 'web', path } }),
    async confirm(kind, name) {
      const choices = {
        unfollow: { type: 'warning', text: () => i18n.tsx.unfollowConfirm({ name }) },
        cancel: { type: 'question', text: () => i18n.tsx.cancelFollowRequestConfirm({ name }) },
        follow: { type: 'question', text: () => i18n.tsx.followConfirm({ name }) },
      };
      const selected = choices[kind];
      if (!selected) throw new Error(`Unknown follow confirmation: ${kind}`);
      return (await confirm({ type: selected.type, text: selected.text() })).canceled;
    },
    subscribe(listener) {
      connection = stream.useChannel('main');
      connection.on('follow', listener);
      connection.on('unfollow', listener);
    },
    dispose() {
      connection?.dispose();
      connection = undefined;
    },
    achievements() {
      const account = getAccount();
      if (account == null) return;
      claimAchievement('following1');
      for (const threshold of [10, 50, 100, 300]) {
        if (account.followingCount >= threshold) claimAchievement(`following${threshold}`);
      }
    },
  };
}
