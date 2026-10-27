/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createMisskeyApi } from '../../src/services/misskey-api.mjs';

export const formServices = {
  api: createMisskeyApi({ apiUrl: '/api', getAccount: () => null }),
  maxTextLength: 1000,
  onPosted: note => { window.fixturePosted = note; },
};
export const formTarget = window.fixtureTarget ?? {};
export const formLabels = { public: 'Public', home: 'Home', followers: 'Followers', specified: 'Direct', cw: 'CW', cwPlaceholder: 'Annotations', placeholder: 'What are you doing?', submit: 'Note' };
