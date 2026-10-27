/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { BroadcastChannel } from 'broadcast-channel';
window.publishPreferenceUpdate = async timestamp => {
  const channel = new BroadcastChannel('preferences');
  await channel.postMessage({ type: 'preferencesUpdate', tabId: 'fixture-other-tab', timestamp });
  await channel.close();
};
