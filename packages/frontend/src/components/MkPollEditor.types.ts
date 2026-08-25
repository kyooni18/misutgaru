/* SPDX-License-Identifier: AGPL-3.0-only */
export type PollEditorModelValue = {
	expiresAt: number | null;
	expiredAfter: number | null;
	choices: string[];
	multiple: boolean;
};
