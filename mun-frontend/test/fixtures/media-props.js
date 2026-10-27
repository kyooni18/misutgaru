/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export const files = window.fixtureFiles ?? [];
export const forceShow = window.fixtureForceShow ?? false;
window.fixtureOpened = [];
window.fixtureConfirmCount = 0;
export const mediaServices = {
  media: () => window.fixtureMediaPrefs ?? { nsfw: 'respect', dataSaverMedia: false },
  confirmReveal: async () => { window.fixtureConfirmCount++; return window.fixtureAllowReveal !== false; },
  open: file => { window.fixtureOpened.push(file.id); },
};
export const mediaLabels = { sensitive: 'Sensitive', clickToShow: 'Click to show', hide: 'Hide', mediaKind: type => type.split('/')[0] };
