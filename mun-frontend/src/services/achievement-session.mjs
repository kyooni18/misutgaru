/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { account, api } from './api.mjs';
import { createAchievementClaimer } from './achievements.mjs';

// One session-wide queue is shared by every follow button and other callers.
export const claimAchievement = createAchievementClaimer({ account, api: (endpoint, data) => api.post(endpoint, data) });
