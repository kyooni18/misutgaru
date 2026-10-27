/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from './misskey-api.mjs';
import { readCachedAccount } from './cached-account.mjs';

// The visitor shell can reuse an existing Vue account cache; sign-in and
// account switching are not implemented here yet.
export const account = readCachedAccount();
export const api = createMisskeyApi({ apiUrl: '/api', getAccount: () => account });
