/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export function createSigninTotpServices({ flow, i18n }) {
  return { labels: i18n.ts, submit: token => flow.submitTotp(token) };
}
