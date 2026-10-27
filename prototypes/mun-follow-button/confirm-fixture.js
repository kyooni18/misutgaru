/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createConfirm } from '../../mun-frontend/src/services/confirm.mjs';
import { createFollowButtonServices } from '../../mun-frontend/src/components/follow-button-services.mjs';
const i18n = { ts: { ok: 'OK', cancel: 'Cancel' }, tsx: { unfollowConfirm: ({ name }) => `Unfollow ${name}?`, cancelFollowRequestConfirm: ({ name }) => `Cancel ${name}?`, followConfirm: ({ name }) => `Follow ${name}?` } };
const confirm = createConfirm(i18n);
const follow = createFollowButtonServices({ i18n, confirm });
window.result = null;
window.openQuestion = () => confirm({ type: 'question', text: 'Unfollow Alice?' });
window.openWithoutMotion = () => createConfirm(i18n, document, { animation: () => false })({ type: 'question', text: 'Follow Alice?', okText: 'Yes', cancelText: 'No' });
document.querySelector('#trigger').addEventListener('click', async () => { window.result = await follow.confirm('unfollow', 'Alice'); });
