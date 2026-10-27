/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import Stream from 'misskey-js/streaming.js';
import { account } from './api.mjs';
import { createStreamManager } from './stream-manager.mjs';

let manager;
export function useStream() {
  manager ??= createStreamManager({ Stream, origin: window.location.origin, getAccount: () => account, document: window.document });
  return manager.useStream();
}
export function disposeStream() {
  manager?.dispose();
  manager = undefined;
}
