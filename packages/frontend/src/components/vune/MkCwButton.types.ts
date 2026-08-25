/* SPDX-License-Identifier: AGPL-3.0-only */
export type CwChangeAction = (value: boolean) => void;
export type CwActions = { change: CwChangeAction };
export function ignoreCwChange(_value: boolean): void {}
