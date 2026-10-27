/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreamManager } from '../src/services/stream-manager.mjs';

test('stream is lazy, shared, authenticated and heartbeats only when visible and connected', () => {
  let clock = 100_000, task, clears = 0, listener, constructions = 0;
  const document = { visibilityState: 'visible', addEventListener(type, fn) { assert.equal(type, 'visibilitychange'); listener = fn; }, removeEventListener(type, fn) { assert.equal(fn, listener); listener = undefined; } };
  class Stream {
    constructor(origin, user) { constructions++; this.origin = origin; this.user = user; this.state = 'connected'; this.beats = 0; }
    heartbeat() { this.beats++; }
    close() { this.closed = true; }
  }
  const manager = createStreamManager({ Stream, origin: 'https://local.test', getAccount: () => ({ token: 'fixture-token' }), document,
    now: () => clock, setTimer(fn, delay) { assert.equal(delay, 60_000); task = fn; return 1; }, clearTimer() { clears++; },
  });
  assert.equal(constructions, 0);
  const stream = manager.useStream();
  assert.equal(manager.useStream(), stream);
  assert.equal(constructions, 1);
  assert.deepEqual([stream.origin, stream.user], ['https://local.test', { token: 'fixture-token' }]);
  clock += 60_000; task(); assert.equal(stream.beats, 1);
  document.visibilityState = 'hidden'; clock += 60_000; task(); assert.equal(stream.beats, 1);
  document.visibilityState = 'visible'; clock += 59_999; listener(); assert.equal(stream.beats, 1);
  clock++; listener(); assert.equal(stream.beats, 2);
  stream.state = 'reconnecting'; clock += 60_000; task(); assert.equal(stream.beats, 2);
  manager.dispose();
  assert.equal(stream.closed, true); assert.equal(listener, undefined); assert.ok(clears > 0);
  assert.notEqual(manager.useStream(), stream);
  manager.dispose();
});

test('signed-out streams use no credential', () => {
  class Stream { constructor(origin, user) { this.user = user; } close() {} }
  const manager = createStreamManager({ Stream, origin: 'https://local.test', getAccount: () => null,
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, setTimer: () => 1, clearTimer() {},
  });
  assert.equal(manager.useStream().user, null);
  manager.dispose();
});
