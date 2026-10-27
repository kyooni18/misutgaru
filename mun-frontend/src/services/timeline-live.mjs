/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Local visitor timeline updates. The host owns initial/older loading and DOM;
// create one controller per mounted timeline after its initial page is ready.
export function createTimelineLive({ api, stream, params, realtime = true, pollingInterval = 3, getItems, setItems, setQueuedCount = () => {}, onTrim = () => {}, isTop, document, scrollContainer, setTimer = setInterval, clearTimer = clearInterval }) {
  let active = false, queue = [], connection = null, timer = null, pending = false, generation = 0;
  const queued = () => setQueuedCount(queue.length);
  const visibleAtTop = () => document.visibilityState !== 'hidden' && isTop();
  function merge(notes, trim) {
    const items = getItems();
    const seen = new Set(items.map(item => item.id));
    const fresh = notes.filter(note => {
      if (seen.has(note.id)) return false;
      seen.add(note.id); return true;
    });
    if (!fresh.length) return;
    const next = fresh.concat(items);
    if (trim && next.length > 30) { setItems(next.slice(0, 30)); onTrim(); }
    else setItems(next);
  }
  function releaseQueue() {
    if (!active || !queue.length) return;
    merge(queue, true); queue = []; queued();
  }
  function accept(notes, trim = true) {
    if (!active || !notes.length) return;
    if (visibleAtTop()) merge(notes, trim);
    else { queue = notes.concat(queue).slice(0, 100); queued(); }
  }
  function onNote(note) { accept([note]); }
  function onVisibility() { if (visibleAtTop()) releaseQueue(); }
  function onScroll() { if (isTop()) releaseQueue(); }
  async function poll() {
    if (!active || pending) return;
    pending = true;
    const ticket = generation;
    const source = queue.length ? queue : getItems();
    const sinceId = source.reduce((max, note) => max == null || note.id > max ? note.id : max, undefined);
    try {
      const notes = await api.post('notes/local-timeline', { ...params, limit: 30, sinceId });
      if (active && ticket === generation) accept(notes.toReversed(), false);
    } catch { /* Polling is retried at the next interval. */ }
    finally { if (ticket === generation) pending = false; }
  }
  return {
    start() {
      if (active) return;
      active = true; generation++;
      document.addEventListener('visibilitychange', onVisibility);
      scrollContainer?.addEventListener('scroll', onScroll, { passive: true });
      if (realtime) {
        connection = stream.useChannel('localTimeline', params);
        connection.on('note', onNote);
      } else {
        const interval = pollingInterval === 1 ? 22500 : pollingInterval === 2 ? 15000 : 10000;
        timer = setTimer(poll, interval);
      }
    },
    releaseQueue,
    dispose() {
      if (!active) return;
      active = false; generation++; pending = false;
      document.removeEventListener('visibilitychange', onVisibility);
      scrollContainer?.removeEventListener('scroll', onScroll);
      if (timer != null) clearTimer(timer);
      timer = null; connection?.dispose(); connection = null; queue = []; queued();
    },
  };
}
