// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vite';
import { munPlugin } from '@mun/vite';
export default defineConfig({ plugins: [munPlugin()], server: { proxy: { '/api': { target: process.env.MISUTGARU_API_ORIGIN || 'http://localhost:3000', changeOrigin: true }, '/assets/locales': { target: process.env.MISUTGARU_API_ORIGIN || 'http://localhost:3000', changeOrigin: true } } } });
