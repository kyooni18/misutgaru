/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createFollowButtonServices } from '../components/follow-button-services.mjs';
import { account, api } from './api.mjs';
import { claimAchievement } from './achievement-session.mjs';
import { createConfirm } from './confirm.mjs';
import { createFollowPreferences, observeFollowPreferences } from './follow-preferences.mjs';
import { useStream } from './stream.mjs';
import { haptic as performHaptic } from 'ios-haptics';
import { BroadcastChannel } from 'broadcast-channel';

// The profile host supplies its login UI and user-store update.
// Transport, confirmation, local preferences, achievements and streaming are
// shared with the native session; the stream is opened only on subscription.
let preferences;
export function createSessionFollowServices({ i18n, pleaseLogin, updateUser, reportError = console.error }) {
  const host = window.location.host;
  if (!preferences) {
    preferences = createFollowPreferences({ host, account, prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    const post = (endpoint, data) => api.post(endpoint, data);
    void preferences.sync(post).catch(reportError);
    observeFollowPreferences({ preferences, api: post, channel: new BroadcastChannel('preferences'), reportError });
  }
  return createFollowButtonServices({
    host, i18n, pleaseLogin, updateUser, reportError,
    haptic: () => { if (preferences.read()['experimental.enableHapticFeedback']) performHaptic(); },
    api: (endpoint, data) => api.post(endpoint, data),
    stream: { useChannel: channel => useStream().useChannel(channel) },
    getAccount: () => account,
    getPreferences: preferences.read,
    confirm: createConfirm(i18n, document, { animation: () => preferences.read().animation }),
    claimAchievement,
  });
}
