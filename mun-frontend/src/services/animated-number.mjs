/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Keep concurrent transitions independent like the Vue watcher, while
// cancelling their scheduled callbacks when the host view disappears.
export function createNumberAnimator(update, { request = requestAnimationFrame, cancel = cancelAnimationFrame } = {}) {
  const frames = new Set();
  let disposed = false;
  function start(from, to) {
    let first;
    const step = time => {
      frames.delete(id);
      if (disposed) return;
      first ??= time;
      const elapsed = time - first;
      update(elapsed < 500 ? from + (to - from) * elapsed / 500 : to);
      if (elapsed < 500) { id = request(step); frames.add(id); }
    };
    let id = request(step);
    frames.add(id);
  }
  function dispose() { disposed = true; for (const id of frames) cancel(id); frames.clear(); }
  return { start, dispose };
}
