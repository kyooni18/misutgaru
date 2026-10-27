/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from './misskey-api.mjs';

// The current visitor-only shell has no account session yet.
export const api = createMisskeyApi({ apiUrl: '/api', getAccount: () => null });
