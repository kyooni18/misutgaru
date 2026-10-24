/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module '*.mun' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function userPopupCard(ctx: Record<string, any>): any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function navbarView(ctx: Record<string, any>): any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function postFormView(ctx: Record<string, any>): any;
}
