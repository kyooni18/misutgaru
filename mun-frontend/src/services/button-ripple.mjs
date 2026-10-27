/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Corresponds to MkButton's pointer ripple for native sign-in buttons.
let nextKey = 0;
export function newRippleKey() { return `passkey-${++nextKey}`; }
export function buttonRipple(event) {
  const button = event.currentTarget;
  const key = button.dataset.rippleKey;
  const rect = button.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const scale = Math.max(Math.hypot(x, y), Math.hypot(button.clientWidth - x, y), Math.hypot(x, button.clientHeight - y), Math.hypot(button.clientWidth - x, button.clientHeight - y));
  // Add after the click's state update, so the renderer does not discard this
  // transient browser-owned child during the same event dispatch.
  setTimeout(() => {
    const current = button.isConnected ? button : button.ownerDocument.querySelector(`[data-ripple-key="${key}"]`);
    const holder = current?.querySelector('.signin-passkey-ripples');
    if (!holder || !current.isConnected) return;
    const ripple = button.ownerDocument.createElement('div');
    ripple.className = 'signin-passkey-ripple';
    ripple.style.top = `${y - 1}px`; ripple.style.left = `${x - 1}px`;
    holder.appendChild(ripple);
    setTimeout(() => { ripple.style.transform = `scale(${scale})`; }, 1);
    setTimeout(() => { ripple.style.transition = 'all 1s ease'; ripple.style.opacity = '0'; }, 1000);
    setTimeout(() => ripple.remove(), 2000);
  }, 0);
}
