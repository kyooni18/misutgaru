/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import { namedArguments } from '@mun/core/compat';
import { SigninDialog } from '../components/SigninDialog.mun';
import { createSigninDialogServices } from './signin-dialog.mjs';
import { createAccountHandoff } from './account-handoff.mjs';
import { createAccountStorage } from './account-storage.mjs';
import { loadI18n } from './locale.mjs';
import { api } from './api.mjs';

let opening = false;
let instance = null;
export function setSigninInstance(meta) { instance = meta; }

function resetPassword(i18n) {
  const dialog = document.createElement('dialog');
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.className = 'signin-recovery';
  const form = document.createElement('form');
  const title = document.createElement('h2');
  title.textContent = i18n.ts.forgotPassword;
  form.append(title);
  if (instance.enableEmail) {
    const username = document.createElement('input');
    username.name = 'username'; username.required = true; username.pattern = '[a-zA-Z0-9_]+'; username.autocomplete = 'username';
    const usernameLabel = document.createElement('label'); usernameLabel.textContent = i18n.ts.username; usernameLabel.append(username);
    const email = document.createElement('input');
    email.name = 'email'; email.type = 'email'; email.required = true; email.autocomplete = 'email';
    const emailLabel = document.createElement('label'); emailLabel.textContent = i18n.ts.emailAddress; emailLabel.append(email);
    const caption = document.createElement('p'); caption.textContent = i18n.ts._forgotPassword.enterEmail;
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = i18n.ts.send;
    const info = document.createElement('p'); info.textContent = i18n.ts._forgotPassword.ifNoEmail;
    form.append(usernameLabel, emailLabel, caption, submit, info);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { await api.post('request-reset-password', { username: username.value, email: email.value }); dialog.close(); window.alert(i18n.ts.done); }
      catch (error) { window.alert(`${i18n.ts.error}: ${errorText(error, i18n)}`); submit.disabled = false; }
    });
  } else {
    const info = document.createElement('p'); info.textContent = i18n.ts._forgotPassword.contactAdmin; form.append(info);
  }
  const close = document.createElement('button'); close.type = 'button'; close.textContent = i18n.ts.close; close.onclick = () => dialog.close(); form.append(close);
  dialog.append(form); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
}

function errorText(error, i18n) {
  if (error?.code === 'RATE_LIMIT_EXCEEDED') return i18n.ts.cannotPerformTemporaryDescription ?? i18n.ts.error;
  if (error?.code === 'INVALID_PARAM') return i18n.ts.invalidParamErrorDescription ?? i18n.ts.error;
  if (error?.code === 'INTERNAL_ERROR') return i18n.ts.internalServerErrorDescription ?? i18n.ts.error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error === 'string') return error;
  return i18n.ts.error;
}

function accountError(error, i18n) {
  const key = {
    'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370': 'yourAccountSuspended',
    'e5b3b9f0-2b8f-4b9f-9c1f-8c5c1b2e1b1a': 'accountDeleted',
    'b0a7f5f8-dc2f-4171-b91f-de88ad238e14': 'tokenRevoked',
  }[error?.id];
  if (key === 'yourAccountSuspended') return `${i18n.ts.yourAccountSuspendedTitle}: ${i18n.ts.yourAccountSuspendedDescription}`;
  if (key) return `${i18n.ts[key]}: ${i18n.ts[key + 'Description']}`;
  return `${i18n.ts.loginFailed}: ${errorText(error, i18n)}`;
}

export async function openVisitorSignin() {
  if (opening || !instance) return;
  opening = true;
  let container;
  try {
    const i18n = await loadI18n();
    const adapters = await createAccountStorage({ host: window.location.host });
    const handoff = createAccountHandoff({ host: window.location.host, ...adapters });
    container = document.createElement('div'); document.body.append(container);
    let dispose;
    const close = () => { dispose?.(); container.remove(); opening = false; };
    const showError = ({ key, error }) => {
      if (key === 'suspended') return window.alert(accountError({ id: 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370' }, i18n));
      window.alert(`${i18n.ts.loginFailed}: ${i18n.ts[key] ?? errorText(error, i18n)}`);
    };
    const services = createSigninDialogServices({
      api: (endpoint, data) => api.post(endpoint, data), i18n, instance, host: window.location.host,
      supportsWebAuthn: () => typeof window.PublicKeyCredential !== 'undefined',
      resetPassword: () => resetPassword(i18n), onError: showError,
      onNoSuchUser: () => showError({ key: 'noSuchUser' }),
      onCancelled: close,
      onDone: result => { dispose?.(); container.remove(); void handoff(result.i).catch(error => window.alert(accountError(error?.cause ?? error, i18n))).finally(() => { opening = false; }); },
    });
    dispose = mount(SigninDialog(namedArguments({ services })), container);
  } catch (error) { container?.remove(); opening = false; window.alert(error?.message ?? String(error)); }
}
