/* SPDX-License-Identifier: AGPL-3.0-only */
export type TagAction = () => void;
export type TagActions = { onClick: TagAction; onExtra: TagAction };
export function ignoreTagAction(): void {}
