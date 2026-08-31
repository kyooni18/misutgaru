/* SPDX-License-Identifier: AGPL-3.0-only */

export function callOptional<TArgs extends unknown[]>(
	action: ((...args: TArgs) => void) | undefined,
	...args: TArgs
): void {
	action?.(...args);
}
