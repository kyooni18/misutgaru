/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Returns a `ref` callback that calls `onVisible` each time the element enters the viewport (root margin lets it fire shortly before).
export function observeVisible(onVisible, { rootMargin = '200px', ObserverImpl = globalThis.IntersectionObserver } = {}) {
  let observer = null;
  return element => {
    if (observer) { observer.disconnect(); observer = null; }
    if (element == null || ObserverImpl == null) return;
    observer = new ObserverImpl(entries => { if (entries.some(e => e.isIntersecting)) onVisible(); }, { rootMargin });
    observer.observe(element);
  };
}
