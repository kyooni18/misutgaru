/* SPDX-License-Identifier: AGPL-3.0-only */
export type PositionAxis = 'left' | 'center' | 'right' | 'top' | 'bottom';
export type PositionUpdateAction = (value: string) => void;
export type PositionActions = { updateX: PositionUpdateAction; updateY: PositionUpdateAction };
export type PositionCellAction = () => void;
export type PositionCellActions = { select: PositionCellAction };
export function ignorePositionUpdate(_value: string): void {}
export function ignorePositionCell(): void {}
