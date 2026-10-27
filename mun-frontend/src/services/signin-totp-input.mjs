/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import tinycolor from 'tinycolor2';

const active = new Map();
function inputFor(key) { return document.querySelector(`[data-totp-input="${key}"]`); }
export function focusTotpInput(key) { inputFor(key)?.focus(); }
export function mountTotpInput(key) {
  const entry = { timer: null, observer: null, resize: null };
  active.set(key, entry);
  entry.timer = setTimeout(() => {
    const input = inputFor(key);
    if (!input || active.get(key) !== entry) return;
    const update = () => {
      let parent = input.parentElement, background = null;
      while (parent && background == null) {
        const color = getComputedStyle(parent).backgroundColor;
        if (color && tinycolor(color).getAlpha() !== 0) background = color;
        parent = parent.parentElement;
      }
      const own = getComputedStyle(input).backgroundColor;
      input.style.borderColor = (background ?? 'transparent') === own ? 'var(--MI_THEME-divider)' : own;
    };
    update();
    const prefix = input.parentElement?.querySelector('.signin-totp-prefix');
    if (prefix) {
      entry.resize = new ResizeObserver(entries => {
        for (const item of entries) {
          const width = item.borderBoxSize[0].inlineSize;
          if (width !== 0) input.style.paddingLeft = `${width}px`;
        }
      });
      entry.resize.observe(prefix);
    }
    entry.observer = new MutationObserver(update);
    entry.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    input.focus();
  }, 0);
}
export function unmountTotpInput(key) {
  const entry = active.get(key);
  if (!entry) return;
  clearTimeout(entry.timer); entry.observer?.disconnect(); entry.resize?.disconnect(); active.delete(key);
}
