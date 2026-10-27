/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import App from './App.mun';
import { control } from './services.js';
import { createMisskeyApi } from '../mun-api/misskey-api.mjs';
if (new URLSearchParams(location.search).has('wire')) {
  control.transport = createMisskeyApi({ apiUrl: '/api', getAccount: () => ({ token: 'fixture-token' }) });
  control.services.api = control.transport.post;
}
control.cleanup = mount(App, document.querySelector('#app'));
window.fixture = control;
