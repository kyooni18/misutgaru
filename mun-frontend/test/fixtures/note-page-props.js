/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { labels, formatTime, api, services } from './note-simple-props.js';

export const pageLabels = { ...labels, continueThread: 'Continue thread' };
export const pageServices = { ...services, requireLogin: err => { window.fixtureLoginError = err?.id ?? null; } };
export { formatTime, api };
