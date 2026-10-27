/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import { namedArguments } from '@mun/core/compat';
import { ConfirmDialog } from '../components/ConfirmDialog.mun';

// The promise contract matches os.confirm. A caller supplies the loaded locale.
export function createConfirm(i18n, document = globalThis.document, { animation = () => true } = {}) {
  return ({ type, text = '', okText, cancelText }) => new Promise((resolve, reject) => {
    if (type !== 'warning' && type !== 'question') { reject(new Error(`Unsupported confirmation type: ${type}`)); return; }
    const animate = animation() && !(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const root = document.createElement('div');
    root.dataset.munConfirmActive = 'true';
    const previousFocus = document.activeElement;
    document.body.appendChild(root);
    let dispose, settled = false;
    const finish = canceled => {
      if (settled) return;
      settled = true;
      root.dataset.munConfirmActive = 'false';
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      root.querySelector('.mun-confirm')?.classList.add('closing');
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      resolve({ canceled });
      const cleanup = () => { dispose?.(); root.remove(); };
      if (animate) document.defaultView.setTimeout(cleanup, 160); else cleanup();
    };
    const isTop = () => [...document.querySelectorAll('[data-mun-confirm-active="true"]')].at(-1) === root;
    const onFocusIn = event => {
      if (isTop() && !root.contains(event.target)) root.querySelector('[data-testid="modal-dialog-ok"]')?.focus();
    };
    const onKeyDown = event => {
      if (!isTop()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true); return; }
      if (event.key !== 'Tab') return;
      const buttons = [...root.querySelectorAll('button:not(:disabled)')];
      if (!buttons.length) { event.preventDefault(); return; }
      if (!root.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0]).focus(); }
      else if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    try {
      dispose = mount(ConfirmDialog(namedArguments({ type, text, okText: okText ?? i18n.ts.ok, cancelText: cancelText ?? i18n.ts.cancel, finish, animate })), root);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('focusin', onFocusIn);
      queueMicrotask(() => { if (!settled) root.querySelector('[data-testid="modal-dialog-ok"]')?.focus(); });
    } catch (error) {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      dispose?.();
      root.remove();
      reject(error);
    }
  });
}
