/* SPDX-License-Identifier: AGPL-3.0-only */
export type ChannelFollowAction = () => void;
export type ChannelFollowActions = { click: ChannelFollowAction };
export function ignoreChannelFollowAction(): void {}
