/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { startAuthentication } from '@simplewebauthn/browser';

// The page owns prompt state; the coordinator owns the resulting API request.
export function createSigninPasskeyServices({ flow, i18n }) {
  return {
    labels: i18n.ts,
    authenticate: options => startAuthentication(options),
    done: credential => flow.submitPasskey(credential),
    useTotp: () => flow.useTotp(),
  };
}
