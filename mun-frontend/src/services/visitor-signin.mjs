/*
 * SPDX-FileCopyrightText: Misisutgaru contributors
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
  const form = document.createElement('form');
  const title = document.createElement('h2');
  title.textContent = i18n.ts.forgotPassword;
  form.append(title);
  if (instance.enableEmail) {
    const username = document.createElement('input');
    username.name = 'username'; username.required = true; username.pattern = '[a-zA-Z0-9_]+'; username.placeholder = i18n.ts.username;
    const email = document.createElement('input');
    email.name = 'email'; email.type = 'email'; email.required = true; email.placeholder = i18n.ts.emailAddress;
    const caption = document.createElement('p'); caption.textContent = i18n.ts._forgotPassword.enterEmail;
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = i18n.ts.send;
    const info = document.createElement('p'); info.textContent = i18n.ts._forgotPassword.ifNoEmail;
    form.append(username, email, caption, submit, info);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { await api.post('request-reset-password', { username: username.value, email: email.value }); dialog.close(); }
      catch (error) { window.alert(i18n.ts.error + ': ' + (error?.message ?? String(error))); submit.disabled = false; }
    });
  } else {
    const info = document.createElement('p'); info.textContent = i18n.ts._forgotPassword.contactAdmin; form.append(info);
  }
  const close = document.createElement('button'); close.type = 'button'; close.textContent = i18n.ts.close; close.onclick = () => dialog.close(); form.append(close);
  dialog.append(form); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
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
    const showError = ({ key, error }) => window.alert(`${i18n.ts.loginFailed}: ${i18n.ts[key] ?? error?.message ?? JSON.stringify(error) ?? i18n.ts.error}`);
    const services = createSigninDialogServices({
      api: (endpoint, data) => api.post(endpoint, data), i18n, instance, host: window.location.host,
      supportsWebAuthn: () => typeof window.PublicKeyCredential !== 'undefined',
      resetPassword: () => resetPassword(i18n), onError: showError,
      onNoSuchUser: () => showError({ key: 'noSuchUser' }),
      onCancelled: close,
      onDone: result => { close(); void handoff(result.i).catch(error => showError({ key: 'unknown', error })); },
    });
    dispose = mount(SigninDialog(namedArguments({ services })), container);
  } catch (error) { container?.remove(); opening = false; window.alert(error?.message ?? String(error)); }
}
