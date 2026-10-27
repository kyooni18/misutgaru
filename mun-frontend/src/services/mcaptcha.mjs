/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export function createMcaptcha({ sitekey, instanceUrl, update, loadReceiver = () => import('@mcaptcha/core-glue') }) {
  let active = false, receiver = null, generation = 0;
  const iframeUrl = sitekey && instanceUrl ? (() => { const url = new URL('/widget', instanceUrl); url.searchParams.set('sitekey', sitekey); return url.toString(); })() : null;
  function callback(value) { if (active) update(typeof value === 'string' ? value : null); }
  function onMessage(event) {
    if (event.data?.token && instanceUrl && new URL(event.origin).host === new URL(instanceUrl).host) callback(event.data.token);
  }
  async function mount() {
    active = true; const ticket = ++generation;
    window.addEventListener('message', onMessage);
    if (!sitekey || !instanceUrl) return;
    try {
      const module = await loadReceiver();
      const Receiver = typeof module.default === 'function' ? module.default : module.default?.default;
      if (!active || ticket !== generation) return;
      receiver = new Receiver({ siteKey: { key: sitekey, instanceUrl: new URL(instanceUrl) } }, callback);
      receiver.listen();
    } catch (error) { console.error('Unable to load mCaptcha receiver', error); }
  }
  function reset() { generation++; receiver?.destroy(); receiver = null; }
  function dispose() { active = false; window.removeEventListener('message', onMessage); reset(); }
  return { iframeUrl, mount, reset, dispose };
}
