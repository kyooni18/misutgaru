/* SPDX-License-Identifier: AGPL-3.0-only */
export type RetryAction = () => void;
export type RetryActions = { retry: RetryAction };
export function ignoreRetry(): void {}
