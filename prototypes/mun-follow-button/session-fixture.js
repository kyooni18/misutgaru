/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { mount } from '@mun/web';
import { namedArguments } from '@mun/core/compat';
import { FollowButton } from '../../mun-frontend/src/components/FollowButton.mun';
import { createSessionFollowServices } from '../../mun-frontend/src/services/follow-session.mjs';
import { loadI18n } from '../../mun-frontend/src/services/locale.mjs';
import { disposeStream } from '../../mun-frontend/src/services/stream.mjs';

const updates = [];
const i18n = await loadI18n();
const services = createSessionFollowServices({ i18n, pleaseLogin: async () => true, updateUser: value => updates.push(value) });
const user = { id: 'alice', username: 'alice', host: null, isLocked: false, isFollowing: false, hasPendingFollowRequestFromYou: false };
const dispose = mount(FollowButton(namedArguments({ user, full: true, large: false, services })), document.querySelector('#app'));
window.sessionFixture = { updates, services, dispose: () => { dispose(); disposeStream(); } };
