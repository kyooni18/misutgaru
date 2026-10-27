/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
const providers = {
  hcaptcha: ['hcaptcha', 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off'],
  recaptcha: ['grecaptcha', 'https://www.recaptcha.net/recaptcha/api.js?render=explicit'],
  turnstile: ['turnstile', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'],
};

// One adapter per mounted widget. Shared scripts remain in the document, just as in Vue.
export function createCaptchaWidget({ provider, sitekey, darkMode = false, update }) {
  const [globalName, src] = providers[provider];
  let active = false, widgetId, timer, script, load;
  const callback = value => { if (active) update(typeof value === 'string' ? value : null); };
  function render(container) {
    if (!active) return;
    const api = window[globalName];
    if (api?.render && sitekey && container.isConnected) {
      const target = document.createElement('div');
      container.appendChild(target);
      widgetId = api.render(target, { sitekey, theme: darkMode ? 'dark' : 'light', callback, 'expired-callback': () => callback(), 'error-callback': () => callback() });
    } else if (container.isConnected) timer = setTimeout(() => render(container), 50);
  }
  function reset() {
    if (widgetId !== undefined) {
      try { window[globalName]?.reset?.(widgetId); } catch { /* Match Vue's best-effort reset. */ }
    }
  }
  function mount(container) {
    active = true;
    if (window[globalName]) { render(container); return; }
    script = document.getElementById(`script-${provider}`);
    if (!script) {
      script = document.createElement('script'); script.async = true; script.id = `script-${provider}`; script.src = src;
      document.head.appendChild(script);
    }
    load = () => render(container);
    script.addEventListener('load', load);
    // A shared script can finish loading just before this listener is attached.
    if (window[globalName]) { script.removeEventListener('load', load); load(); }
  }
  function dispose() {
    active = false; clearTimeout(timer);
    if (load) script?.removeEventListener('load', load);
    reset();
    if (widgetId !== undefined) {
      try { window[globalName]?.remove?.(widgetId); } catch { /* Match Vue's best-effort removal. */ }
    }
    widgetId = undefined;
  }
  return { mount, reset, dispose };
}
