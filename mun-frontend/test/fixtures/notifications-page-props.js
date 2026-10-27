/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { nLabels, formatTime, api, services, me } from './notifications-props.js';
import { notificationTypes } from '../../src/services/notifications-page.mjs';

export const pageLabels = {
  ...nLabels, filter: 'Filter', markAllAsRead: 'Mark all as read', clear: 'Clear',
  tabs: { all: 'All', mentions: 'Mentions', directNotes: 'Direct notes' },
  types: Object.fromEntries(notificationTypes.map(t => [t, 'type:' + t])),
};
export const grouped = false;
export { formatTime, api, services, me };
