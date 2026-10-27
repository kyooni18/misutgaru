/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import Fixture from './NoteFixture.mun';
window.fixtureCleanup = mount(Fixture, document.querySelector('#app'));
