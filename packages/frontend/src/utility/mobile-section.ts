/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';

export type MobileSection = 'timeline' | 'notifications' | 'widgets';

// Which main view the phone shell shows on the timeline page.
export const mobileSection = ref<MobileSection>('timeline');
