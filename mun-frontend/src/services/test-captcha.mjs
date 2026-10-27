/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Like MkCaptcha.reset(), reset clears the widget but does not emit a value.
export function createTestCaptchaServices(update) {
  let resetWidget = null;
  return {
    update,
    attachReset: reset => { resetWidget = reset; },
    detachReset: () => { resetWidget = null; },
    reset: () => resetWidget?.(),
  };
}
