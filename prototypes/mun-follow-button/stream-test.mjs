/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFollowButtonServices } from './services-adapter.mjs';

// The SDK is real; only its WebSocket transport is replaced, so no network or
// backend account is needed. Build misskey-js first or provide its built file.
const sdk = process.env.MISSKEY_STREAM_MODULE ?? fileURLToPath(new URL('../../packages/misskey-js/built/streaming.js', import.meta.url));
const { default: Stream } = await import(pathToFileURL(path.resolve(sdk)).href);
const messages = [];
let socket;
class FakeWebSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;
  constructor(url) {
    super(); socket = this; this.url = url;
    queueMicrotask(() => { this.readyState = FakeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
  }
  send(data) { messages.push(JSON.parse(data)); }
  receive(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  close() { this.readyState = FakeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
}
const stream = new Stream('https://instance.test', { token: 'fixture-token' }, { WebSocket: FakeWebSocket });
const waitFor = async predicate => {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for stream state');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const dependencies = {
  host: 'instance.test', api() {}, stream, getAccount: () => ({ followingCount: 0 }), getPreferences: () => ({}),
  i18n: { ts: {}, tsx: {} }, pleaseLogin() {}, confirm() {}, haptic() {}, claimAchievement() {}, updateUser() {},
};
const first = createFollowButtonServices(dependencies), second = createFollowButtonServices(dependencies);
try {
  await waitFor(() => stream.state === 'connected');
  assert.equal(new URL(socket.url).searchParams.get('i'), 'fixture-token');
  const firstEvents = [], secondEvents = [];
  first.subscribe(user => firstEvents.push(user));
  second.subscribe(user => secondEvents.push(user));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'connect');
  assert.equal(messages[0].body.channel, 'main');
  const id = messages[0].body.id;
  socket.receive({ type: 'channel', body: { id, type: 'follow', body: { id: 'alice', isFollowing: true } } });
  assert.deepEqual(firstEvents, [{ id: 'alice', isFollowing: true }]);
  assert.deepEqual(secondEvents, firstEvents);
  first.dispose();
  socket.receive({ type: 'channel', body: { id, type: 'unfollow', body: { id: 'alice', isFollowing: false } } });
  assert.equal(firstEvents.length, 1);
  assert.deepEqual(secondEvents[1], { id: 'alice', isFollowing: false });
  assert.equal(messages.length, 1, 'disposing one consumer must not disconnect the shared channel');
  second.dispose();
  await waitFor(() => messages.some(message => message.type === 'disconnect'));
  assert.deepEqual(messages.find(message => message.type === 'disconnect').body, { id });
  console.log('PASS: real misskey-js shared main channel, event routing and independent disposal');
} finally {
  first.dispose(); second.dispose(); stream.close();
}
