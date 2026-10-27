// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vite';
import { munPlugin } from '@mun/vite';
const target = process.env.MISUTGARU_API_ORIGIN || 'http://localhost:3000';
export default defineConfig({ plugins: [munPlugin()], server: { proxy: Object.fromEntries(['/api', '/assets/locales', '/avatar', '/twemoji', '/fluent-emoji'].map(path => [path, { target, changeOrigin: true }])) } });
