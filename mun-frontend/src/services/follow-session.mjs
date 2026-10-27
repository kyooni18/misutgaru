/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createFollowButtonServices } from '../components/follow-button-services.mjs';
import { account, api } from './api.mjs';
import { claimAchievement } from './achievement-session.mjs';
import { createConfirm } from './confirm.mjs';
import { createFollowPreferences } from './follow-preferences.mjs';
import { useStream } from './stream.mjs';

// The profile host supplies its login UI, haptics, and user-store update.
// Transport, confirmation, local preferences, achievements and streaming are
// shared with the native session; the stream is opened only on subscription.
export function createSessionFollowServices({ i18n, pleaseLogin, haptic, updateUser, reportError = console.error }) {
  const host = window.location.host;
  const preferences = createFollowPreferences({ host, account, prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return createFollowButtonServices({
    host, i18n, pleaseLogin, haptic, updateUser, reportError,
    api: (endpoint, data) => api.post(endpoint, data),
    stream: { useChannel: channel => useStream().useChannel(channel) },
    getAccount: () => account,
    getPreferences: preferences.read,
    confirm: createConfirm(i18n, document, { animation: () => preferences.read().animation }),
    claimAchievement,
  });
}
