/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const HEARTBEAT_INTERVAL = 60_000;

// A single SDK stream is shared by its channel consumers. The SDK owns
// channel sharing and reconnection; this manager mirrors Vue's heartbeat.
export function createStreamManager({ Stream, origin, getAccount, document, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
  let stream = null;
  let timer = null;
  let lastHeartbeat = 0;

  function heartbeat() {
    if (stream?.state === 'connected' && document.visibilityState === 'visible') stream.heartbeat();
    lastHeartbeat = now();
    if (timer != null) clearTimer(timer);
    timer = setTimer(heartbeat, HEARTBEAT_INTERVAL);
  }
  function onVisibilityChange() {
    if (!stream || document.visibilityState !== 'visible' || now() - lastHeartbeat < HEARTBEAT_INTERVAL) return;
    heartbeat();
  }
  return {
    useStream() {
      if (stream) return stream;
      const account = getAccount();
      stream = new Stream(origin, account ? { token: account.token } : null);
      timer = setTimer(heartbeat, HEARTBEAT_INTERVAL);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return stream;
    },
    dispose() {
      if (timer != null) clearTimer(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stream?.close();
      stream = null;
      lastHeartbeat = 0;
    },
  };
}
