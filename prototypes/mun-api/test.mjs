/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createMisskeyApi } from './misskey-api.mjs';

const require = createRequire(new URL('../mun-follow-button/fixture.js', import.meta.url));
const { createServer } = await import(require.resolve('vite'));
const source = fileURLToPath(new URL('../../packages/frontend/src/utility/misskey-api.ts', import.meta.url));
const stubs = {
  vue: 'export const ref=value=>({value})',
  'misskey-js': 'export {}',
  '@@/js/config.js': 'export const apiUrl="https://instance.test/api"',
  '@/i.js': 'export let $i=null; export function setAccount(value){$i=value}',
};
const stubPlugin = {
  name: 'misskey-api-reference-stubs', enforce: 'pre',
  resolveId(id) { if (Object.hasOwn(stubs, id)) return `\0reference:${id}`; },
  load(id) { if (id.startsWith('\0reference:')) return stubs[id.slice('\0reference:'.length)]; },
};
const server = await createServer({ configFile: false, logLevel: 'error', plugins: [stubPlugin], server: { middlewareMode: true }, appType: 'custom' });
let account = null;
let fetchHandler;
globalThis.window = { fetch: (...args) => fetchHandler(...args) };
const native = createMisskeyApi({ apiUrl: 'https://instance.test/api', getAccount: () => account, fetch: (...args) => fetchHandler(...args) });
try {
  const vue = await server.ssrLoadModule(source);
  const accountModule = await server.ssrLoadModule('@/i.js');
  function setAccount(value) { account = value; accountModule.setAccount(value); }
  async function compare({ endpoint = 'notes/create', data = {}, token, response, method = 'post', signal }) {
    const traces = [];
    async function run(implementation) {
      const input = structuredClone(data);
      fetchHandler = async (url, options) => {
        traces.push({ url, ...options });
        if (response instanceof Error) throw response;
        return new Response(response?.body ?? null, { status: response?.status ?? 200 });
      };
      let result;
      try { result = { value: await (method === 'get' ? implementation.get(endpoint, input) : implementation.post(endpoint, input, token, signal)) }; }
      catch (error) { result = { error }; }
      await Promise.resolve();
      assert.equal(implementation.pending(), 0);
      return { result, input };
    }
    const vueSide = { post: vue.misskeyApi, get: vue.misskeyApiGet, pending: () => vue.pendingApiRequestsCount.value };
    const nativeSide = { ...native, pending: () => native.pendingRequests };
    const reference = await run(vueSide);
    const actual = await run(nativeSide);
    assert.deepEqual(actual, reference);
    assert.deepEqual(traces[1], traces[0]);
  }
  setAccount(null);
  await compare({ data: { text: 'hello' }, token: null, response: { body: '{"id":"n1"}' } });
  await compare({ data: { i: 'existing' }, response: { body: '{}' } });
  setAccount({ token: 'account-token' });
  await compare({ data: { text: 'follow' }, response: { body: '{"ok":true}' } });
  await compare({ data: { i: 'original' }, token: 'override', response: { status: 204 } });
  await compare({ data: { limit: 5 }, method: 'get', response: { body: '{}' } });
  await compare({ data: {}, response: { status: 400, body: '{"error":{"code":"BAD_REQUEST"}}' } });
  await compare({ data: {}, response: new Error('network failed') });
  await compare({ data: {}, response: { status: 200, body: 'not json' } });
  const controller = new AbortController();
  await compare({ data: {}, signal: controller.signal, response: { body: '{}' } });
  assert.throws(() => vue.misskeyApi('https://bad.test'), /invalid endpoint/);
  assert.throws(() => native.post('https://bad.test'), /invalid endpoint/);

  let finish;
  fetchHandler = () => new Promise(resolve => { finish = resolve; });
  const request = native.post('ping');
  assert.equal(native.pendingRequests, 1);
  finish(new Response(null, { status: 204 }));
  await request;
  await Promise.resolve();
  assert.equal(native.pendingRequests, 0);
  const finishBoth = [];
  fetchHandler = () => new Promise(resolve => { finishBoth.push(resolve); });
  const first = native.post('one');
  const second = native.get('two');
  assert.equal(native.pendingRequests, 2);
  finishBoth[0](new Response(null, { status: 204 }));
  await first;
  await Promise.resolve();
  assert.equal(native.pendingRequests, 1);
  finishBoth[1](new Response(null, { status: 204 }));
  await second;
  await Promise.resolve();
  assert.equal(native.pendingRequests, 0);
  console.log('PASS: native and Vue API wire format, credentials, responses, errors, signal and pending count');
} finally {
  delete globalThis.window;
  await server.close();
}
