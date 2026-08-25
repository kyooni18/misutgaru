/* SPDX-License-Identifier: AGPL-3.0-only */
export type SwitchToggleAction = () => void;
export type SwitchActions = { toggle: SwitchToggleAction };
export function ignoreSwitchToggle(): void {}
