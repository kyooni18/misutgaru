/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export const emojis = ['👍', '❤️', '😆'];
export const pickerLabels = { reaction: 'Reaction' };
export const onChoose = r => { window.fixtureChosen = r; };
export const onClose = () => { window.fixtureClosed = true; };
