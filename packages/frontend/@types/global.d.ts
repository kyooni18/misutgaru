/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type FIXME = any;

declare const _LANGS_: string[][];
declare const _VERSION_: string;
declare const _ENV_: string;
declare const _DEV_: boolean;
declare const _PERF_PREFIX_: string;

// Vune sources are lowered by the Vite plugin before bundling and are not
// parsed by TypeScript directly.
declare module '*.vune' {
	const component: any;
	export default component;
}

declare module '*.vune?vue-host' {
	const component: import('vue').Component;
	export default component;
}

// for dev-mode
declare const _LANGS_FULL_: string[][];
