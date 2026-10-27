/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import Fixture from './LightboxFixture.mun';
window.fixtureCleanup = mount(Fixture, document.querySelector('#app'));
