/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const errorKeys = {
  '6cc579cc-885d-43d8-95c2-b8c7fc963280': 'noSuchUser',
  '932c904e-9460-45b7-9ce6-7ed33be7eb2c': 'incorrectPassword',
  'e03a5f46-d309-4865-9b69-56282d94e1eb': 'suspended',
  '22d05606-fbcf-421a-a2db-b32610dcfd1b': 'rateLimitExceeded',
  'cdf1235b-ac71-46d4-a3a6-84ccce48df6f': 'incorrectTotp',
  '36b96a7d-b547-412d-aeed-2d611cdc8cdc': 'unknownWebAuthnKey',
  '93b86c4b-72f9-40eb-9815-798928603d1e': 'passkeyVerificationFailed',
  'b18c89a7-5b5e-4cec-bb5b-0419f332d430': 'passkeyVerificationFailed',
  '2d84773e-f7b7-4d0b-8f72-bb69b584c912': 'passkeyVerificationSucceededButPasswordlessLoginDisabled',
};

// The host supplies UI, WebAuthn and account handoff. Passwords remain private
// to this coordinator and are cleared when it is disposed.
export function createSigninFlow({ api, supportsWebAuthn, onChange = () => {}, onLogin = () => {}, login = async () => {}, autoSet = false, onError = () => {}, onNoSuchUser = () => {}, resetCaptcha = () => {} }) {
  let state = { page: 'input', waiting: false, user: null, needCaptcha: false, credentialRequest: null, passwordless: false };
  let password = '', context = '', generation = 0, disposed = false;
  const snapshot = () => ({ ...state });
  const set = changes => { if (!disposed) { state = { ...state, ...changes }; onChange(snapshot()); } };
  const active = ticket => !disposed && ticket === generation;
  const begin = () => { if (disposed || state.waiting) return null; const ticket = ++generation; set({ waiting: true }); return active(ticket) ? ticket : null; };
  function fail(error, ticket) {
    if (!active(ticket)) return;
    onError({ key: errorKeys[error?.id] ?? 'unknown', error });
    if (state.passwordless) { password = ''; set({ page: 'input', passwordless: false }); }
    resetCaptcha();
    set({ waiting: false });
  }
  async function success(result, ticket) {
    if (!active(ticket)) return;
    onLogin(result);
    if (autoSet) await login(result.i);
  }
  async function tryLogin(request, ticket) {
    try {
      const result = await api('signin-flow', request);
      if (!active(ticket)) return;
      if (result.finished) { await success(result, ticket); return; }
      const changes = { waiting: false };
      if (result.next === 'captcha') Object.assign(changes, { page: 'password', needCaptcha: true });
      else if (result.next === 'password') Object.assign(changes, { page: 'password', needCaptcha: false });
      else if (result.next === 'totp') changes.page = 'totp';
      else if (result.next === 'passkey') {
        if (supportsWebAuthn()) Object.assign(changes, { page: 'passkey', credentialRequest: result.authRequest });
        else changes.page = 'totp';
      }
      if (state.passwordless) { password = ''; Object.assign(changes, { page: 'input', passwordless: false }); }
      resetCaptcha();
      set(changes);
    } catch (error) { fail(error, ticket); }
  }
  async function submitUsername(username) {
    const ticket = begin(); if (ticket == null) return;
    let user;
    try { user = await api('users/show', { username }); } catch { user = null; }
    if (!active(ticket)) return;
    set({ user });
    await tryLogin({ username }, ticket);
  }
  async function submitPassword(value) {
    const ticket = begin(); if (ticket == null) return;
    password = value.password;
    if (state.user == null) { await onNoSuchUser(); if (active(ticket)) set({ waiting: false }); return; }
    const captcha = value.captcha;
    await tryLogin({ username: state.user.username, password, 'hcaptcha-response': captcha.hCaptchaResponse, 'm-captcha-response': captcha.mCaptchaResponse, 'g-recaptcha-response': captcha.reCaptchaResponse, 'turnstile-response': captcha.turnstileResponse, 'testcaptcha-response': captcha.testcaptchaResponse }, ticket);
  }
  async function submitTotp(token) {
    const ticket = begin(); if (ticket == null) return;
    if (state.user == null) { await onNoSuchUser(); if (active(ticket)) set({ waiting: false }); return; }
    await tryLogin({ username: state.user.username, password, token }, ticket);
  }
  async function startPasskey() {
    if (!supportsWebAuthn()) return;
    const ticket = begin(); if (ticket == null) return;
    set({ passwordless: true });
    try {
      const result = await api('signin-with-passkey', {});
      if (!active(ticket)) return;
      context = result.context ?? '';
      set({ page: 'passkey', credentialRequest: result.option, waiting: false });
    } catch (error) { fail(error, ticket); }
  }
  async function submitPasskey(credential) {
    const ticket = begin(); if (ticket == null) return;
    if (state.passwordless) {
      try {
        const result = await api('signin-with-passkey', { credential, context });
        if (!active(ticket)) return;
        if (result.signinResponse == null) { fail(undefined, ticket); return; }
        await success(result.signinResponse, ticket);
      } catch (error) { fail(error, ticket); }
    } else if (state.user != null) await tryLogin({ username: state.user.username, password, credential }, ticket);
    else if (active(ticket)) set({ waiting: false });
  }
  function useTotp() { if (!state.waiting) set({ page: 'totp' }); }
  function dispose() { disposed = true; generation++; password = ''; context = ''; state = { page: 'input', waiting: false, user: null, needCaptcha: false, credentialRequest: null, passwordless: false }; }
  return { snapshot, submitUsername, submitPassword, submitTotp, startPasskey, submitPasskey, useTotp, dispose };
}
