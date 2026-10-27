/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { defineConfig } from 'vite';
import { munPlugin } from '@mun/vite';
export default defineConfig({ plugins: [munPlugin({ include: /\.mun(\?.*)?$/ })], server: { fs: { allow: ['../..', process.env.MUN_ROOT ?? '../../packages/modules/Mun'] } } });
