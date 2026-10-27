/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createCaptchaWidget } from './captcha-widget.mjs';
import { createTestCaptchaServices } from './test-captcha.mjs';

// The host supplies the forgot-password dialog and owns the coordinator.
export function createSigninPasswordServices({ flow, i18n, instance, resetPassword, darkMode = false, formatName = name => name }) {
  let updateCaptcha = null;
  const testCaptcha = createTestCaptchaServices(value => updateCaptcha?.('testcaptchaResponse', value));
  const widgets = Object.fromEntries([['hcaptcha', 'hCaptchaResponse'], ['recaptcha', 'reCaptchaResponse'], ['turnstile', 'turnstileResponse']].map(([provider, field]) => [provider, createCaptchaWidget({ provider, sitekey: instance[provider + 'SiteKey'], darkMode, update: value => updateCaptcha?.(field, value) })]));
  return {
    labels: i18n.ts,
    instance,
    testCaptcha,
    widgets,
    welcome: user => i18n.ts.welcomeBackWithName.replace('{name}', formatName(user.name ?? user.username)),
    resetPassword,
    submit: value => flow.submitPassword(value),
    attach: update => { updateCaptcha = update; },
    detach: () => { updateCaptcha = null; },
    resetCaptcha: () => { testCaptcha.reset(); for (const widget of Object.values(widgets)) widget.reset(); },
  };
}
