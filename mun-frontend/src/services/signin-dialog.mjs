/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createSigninViewServices } from './signin-view.mjs';

// The owner removes the dialog in response to done/cancelled, and handles
// account activation if requested. Each dialog receives fresh services.
export function createSigninDialogServices({ onDone, onCancelled, ...options }) {
  let active = false, settled = false, previousFocus = null;
  const view = createSigninViewServices({ ...options, onLogin: result => { if (!settled) { settled = true; onDone(result); } } });
  function cancel() { if (active && !settled) { settled = true; onCancelled(); } }
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    if (event.key !== 'Tab') return;
    const panel = document.querySelector('[data-signin-dialog-active]');
    const controls = [...(panel?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') ?? [])].filter(element => !element.closest('[inert]') && element.getClientRects().length);
    if (!controls.length) { event.preventDefault(); panel?.focus(); return; }
    const index = controls.indexOf(document.activeElement);
    if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus();
    }
  }
  return {
    labels: options.i18n.ts, view, cancel,
    mount() { active = true; previousFocus = document.activeElement; window.addEventListener('keydown', keydown); },
    unmount() { active = false; window.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null; },
  };
}
