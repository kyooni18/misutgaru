/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import App from './App.mun';
import { control } from './services.js';
control.cleanup = mount(App, document.querySelector('#app'));
window.fixture = control;
