/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Validate the proposed state-input compiler fix on the actual component
// before changing its source to require a framework version containing it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { namedArguments } from '@mun/core/compat';
import { mount, renderToHTML } from '@mun/web';

if (!process.env.MUN_COMPILER_MODULE) throw new Error('Set MUN_COMPILER_MODULE to the built patched Mün compiler index.js');
const { compileMunFile } = await import(pathToFileURL(path.resolve(process.env.MUN_COMPILER_MODULE)).href);
const source = await readFile(new URL('./FollowButton.mun', import.meta.url), 'utf8');
const revised = source
  .replace('@State var following = false', '@State var following = user.isFollowing')
  .replace('@State var pending = false', '@State var pending = user.hasPendingFollowRequestFromYou')
  .replace('    if (!initialized) { return user.isFollowing }\n', '')
  .replace('    if (!initialized) { return user.hasPendingFollowRequestFromYou }\n', '')
  .replace('    update(user)\n', '');
assert.notEqual(revised, source);
const { code } = compileMunFile(revised, 'FollowButton.mun');
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replaceAll('"@mun/core/compat"', JSON.stringify(import.meta.resolve('@mun/core/compat')))
  .replaceAll('"@mun/core"', JSON.stringify(import.meta.resolve('@mun/core')));
const { FollowButton } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
let listener;
let resolveRequest;
const services = {
  labels: { processing: 'Processing', pending: 'Pending', following: 'Following', request: 'Request', follow: 'Follow' },
  host: 'local.test', signedIn: () => true, login: async () => true, haptic() {},
  api: () => new Promise(resolve => { resolveRequest = resolve; }), subscribe(fn) { listener = fn; }, dispose() {},
  updateUser() {}, achievements() {}, reportError(error) { throw error; }, defaultFollowWithReplies: true,
};
const user = { id: '1', username: 'alice', host: null, isLocked: false, isFollowing: true, hasPendingFollowRequestFromYou: false };
const view = FollowButton(namedArguments({ user, full: true, large: false, services }));
assert.match(renderToHTML(view), /Following/);
const pendingView = FollowButton(namedArguments({ user: { ...user, isFollowing: false, isLocked: true, hasPendingFollowRequestFromYou: true }, full: true, large: false, services }));
assert.match(renderToHTML(pendingView), /Pending/);
const freshView = FollowButton(namedArguments({ user: { ...user, isFollowing: false }, full: true, large: false, services }));
assert.match(renderToHTML(freshView), /Follow/);
const dom = new JSDOM('<main></main>');
const root = dom.window.document.querySelector('main');
const dispose = mount(view, root);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
try {
  await flush();
  assert.equal(root.querySelector('button').textContent, 'Following');
  listener({ id: '1', isFollowing: false, hasPendingFollowRequestFromYou: false });
  await flush();
  assert.equal(root.querySelector('button').textContent, 'Follow');
  root.querySelector('button').click();
  await flush();
  assert.equal(root.querySelector('button').disabled, true);
  resolveRequest({}); await flush();
  assert.equal(root.querySelector('button').disabled, false);
  assert.equal(root.querySelector('button').textContent, 'Processing');
  console.log('PASS: patched compiler initializes actual follow component from user input and preserves interactions');
} finally { dispose(); dom.window.close(); }
