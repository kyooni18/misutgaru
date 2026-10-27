// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { mount } from '@mun/web';
import App from './App.mun';
import './style.css';
import { account } from './services/api.mjs';
import { refreshCachedAccount } from './services/cached-account.mjs';

// Vue refreshes a cached account without delaying initial rendering.
void refreshCachedAccount(account).then(result => {
  if (result.status === 'invalid') console.warn('[account] Cached account needs authentication');
});
mount(App, document.getElementById('app'));
