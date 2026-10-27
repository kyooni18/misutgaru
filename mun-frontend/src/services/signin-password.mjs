/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createTestCaptchaServices } from './test-captcha.mjs';

// The host supplies the forgot-password dialog and owns the coordinator.
export function createSigninPasswordServices({ flow, i18n, instance, resetPassword, formatName = name => name }) {
  let updateTestCaptcha = null;
  const testCaptcha = createTestCaptchaServices(value => updateTestCaptcha?.(value));
  return {
    labels: i18n.ts,
    instance,
    testCaptcha,
    welcome: user => i18n.ts.welcomeBackWithName.replace('{name}', formatName(user.name ?? user.username)),
    resetPassword,
    submit: value => flow.submitPassword(value),
    attach: update => { updateTestCaptcha = update; },
    detach: () => { updateTestCaptcha = null; },
    resetCaptcha: () => testCaptcha.reset(),
  };
}
