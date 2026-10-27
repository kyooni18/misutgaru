/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// The real compiled component and Misskey Stream run together; only the
// WebSocket transport and application services are replaced by fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { compileMunFile } from '@mun/compiler';
import { namedArguments } from '@mun/core/compat';
import { mount } from '@mun/web';
import { createFollowButtonServices } from '../../mun-frontend/src/components/follow-button-services.mjs';

const sdkPath = process.env.MISSKEY_STREAM_MODULE ?? new URL('../../packages/misskey-js/built/streaming.js', import.meta.url).pathname;
const { default: Stream } = await import(pathToFileURL(path.resolve(sdkPath)).href);
const source = await readFile(new URL('../../mun-frontend/src/components/FollowButton.mun', import.meta.url), 'utf8');
const { code } = compileMunFile(source.replace('import "./follow-button.css"', ''), 'FollowButton.mun');
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replaceAll('"@mun/core/compat"', JSON.stringify(import.meta.resolve('@mun/core/compat')))
  .replaceAll('"@mun/core"', JSON.stringify(import.meta.resolve('@mun/core')));
const { FollowButton } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const sent = [];
let socket;
class FakeWebSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;
  constructor() { super(); socket = this; queueMicrotask(() => { this.readyState = FakeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
  send(data) { sent.push(JSON.parse(data)); }
  receive(type, id, user) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'channel', body: { id, type, body: user } }) })); }
  close() { this.readyState = FakeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
}
const stream = new Stream('https://instance.test', { token: 'fixture-token' }, { WebSocket: FakeWebSocket });
const dom = new JSDOM('<main><div id="first"></div><div id="second"></div></main>');
const firstRoot = dom.window.document.querySelector('#first'), secondRoot = dom.window.document.querySelector('#second');
const waitFor = async predicate => {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for UI or stream');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const apiCalls = [];
const deps = {
  host: 'instance.test', stream, api: async (endpoint, body) => { apiCalls.push([endpoint, body]); }, getAccount: () => ({ followingCount: 0 }), getPreferences: () => ({ defaultFollowWithReplies: true }),
  i18n: { ts: { follow: 'Follow', youFollowing: 'Following', processing: 'Processing' }, tsx: {} },
  pleaseLogin: async () => true, confirm() {}, haptic() {}, claimAchievement() {}, updateUser() {},
};
const makeView = id => FollowButton(namedArguments({ user: { id, username: id, host: null, isLocked: false, isFollowing: false, hasPendingFollowRequestFromYou: false }, full: true, large: false, services: createFollowButtonServices(deps) }));
let disposeFirst, disposeSecond;
try {
  await waitFor(() => stream.state === 'connected');
  disposeFirst = mount(makeView('alice'), firstRoot);
  disposeSecond = mount(makeView('bob'), secondRoot);
  await waitFor(() => sent.some(message => message.type === 'connect'));
  assert.equal(sent.filter(message => message.type === 'connect').length, 1);
  const id = sent.find(message => message.type === 'connect').body.id;
  assert.equal(firstRoot.textContent, 'Follow'); assert.equal(secondRoot.textContent, 'Follow');
  socket.receive('follow', id, { id: 'alice', isFollowing: true, hasPendingFollowRequestFromYou: false });
  await waitFor(() => firstRoot.textContent === 'Following');
  assert.equal(secondRoot.textContent, 'Follow', 'events for Alice must not update Bob');
  disposeFirst(); disposeFirst = undefined;
  secondRoot.querySelector('button').click();
  await waitFor(() => secondRoot.textContent === 'Processing');
  assert.deepEqual(apiCalls, [['following/create', { userId: 'bob', withReplies: true }]]);
  socket.receive('follow', id, { id: 'bob', isFollowing: true, hasPendingFollowRequestFromYou: false });
  await waitFor(() => secondRoot.textContent === 'Following');
  assert.equal(firstRoot.textContent, '');
  assert.equal(sent.some(message => message.type === 'disconnect'), false);
  disposeSecond(); disposeSecond = undefined;
  await waitFor(() => sent.some(message => message.type === 'disconnect'));
  assert.deepEqual(sent.find(message => message.type === 'disconnect').body, { id });
  console.log('PASS: two native follow buttons share SDK channel while keeping state and disposal independent');
} finally {
  disposeFirst?.(); disposeSecond?.(); stream.close(); dom.window.close();
}
