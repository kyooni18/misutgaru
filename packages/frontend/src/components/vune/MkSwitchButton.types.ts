/* SPDX-License-Identifier: AGPL-3.0-only */
export type SwitchToggleAction = (value: boolean) => void;
export type SwitchActions = { toggle: SwitchToggleAction };
export function ignoreSwitchToggle(_value: boolean): void {}
