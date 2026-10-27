/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createSigninFlow } from './signin-flow.mjs';
import { createSigninPasswordServices } from './signin-password.mjs';
import { createSigninTotpServices } from './signin-totp.mjs';
import { createSigninPasskeyServices } from './signin-passkey.mjs';

// Callers own external dialogs, authentication completion and navigation.
export function createSigninViewServices({ api, i18n, instance, supportsWebAuthn, host, initialUsername = '', message = '', openOnRemote = null, openRemote = () => {}, specifyRemote = () => {}, resetPassword, onLogin, onError, onNoSuchUser, autoSet = false, login, darkMode = false }) {
  let observer = null;
  let password;
  const flow = createSigninFlow({ api, supportsWebAuthn, autoSet, login, onLogin, onError, onNoSuchUser, onChange: state => observer?.(state), resetCaptcha: () => password?.resetCaptcha() });
  password = createSigninPasswordServices({ flow, i18n, instance, resetPassword, darkMode });
  return {
    flow, password,
    totp: createSigninTotpServices({ flow, i18n }),
    passkey: createSigninPasskeyServices({ flow, i18n }),
    input: { labels: i18n.ts, host, initialUsername, message, openOnRemote, openRemote: () => openRemote(openOnRemote), specifyRemote: () => specifyRemote(openOnRemote), submit: username => flow.submitUsername(username), passkey: () => flow.startPasskey() },
    attach: fn => { observer = fn; fn(flow.snapshot()); },
    dispose: () => { observer = null; flow.dispose(); },
  };
}
