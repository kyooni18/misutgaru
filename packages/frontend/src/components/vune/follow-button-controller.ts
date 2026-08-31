/* SPDX-License-Identifier: AGPL-3.0-only */
import { State } from 'vune-ui';
import type { StateRef } from 'vune-ui';
import * as Misskey from 'misskey-js';
import { host } from '@@/js/config.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import { claimAchievement } from '@/utility/achievements.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';
import { haptic } from '@/utility/haptic.js';

type Connection = Misskey.IChannelConnection<Misskey.Channels['main']>;
export type FollowButtonController = {
	isFollowing: StateRef<boolean>;
	pending: StateRef<boolean>;
	wait: StateRef<boolean>;
	click: (user: Misskey.entities.UserDetailed, onUpdate?: (user: Misskey.entities.UserDetailed) => void) => Promise<void>;
};

type Entry = FollowButtonController & { userId: string };
const entries = new Map<string, Entry>();
let connection: Connection | null = null;

function applyFollowState(next: Misskey.entities.UserDetailed): void {
	const entry = entries.get(next.id);
	if (!entry) return;
	entry.isFollowing.value = next.isFollowing === true;
	entry.pending.value = next.hasPendingFollowRequestFromYou === true;
}

function ensureConnection(): void {
	if (connection) return;
	const main = useStream().useChannel('main');
	main.on('follow', applyFollowState);
	main.on('unfollow', applyFollowState);
	connection = main;
}

function entryFor(user: Misskey.entities.UserDetailed): Entry {
	let entry = entries.get(user.id);
	if (entry) return entry;
	const isFollowing = State(user.isFollowing === true);
	const pending = State(user.hasPendingFollowRequestFromYou === true);
	const wait = State(false);
	entry = {
		userId: user.id,
		isFollowing,
		pending,
		wait,
		async click(target, onUpdate) {
			const loggedIn = await pleaseLogin({ openOnRemote: { type: 'web', path: `/@${target.username}@${target.host ?? host}` } });
			if (!loggedIn) return;
			wait.value = true;
			haptic();
			try {
				if (isFollowing.value) {
					const { canceled } = await os.confirm({ type: 'warning', text: i18n.tsx.unfollowConfirm({ name: target.name || target.username }) });
					if (canceled) return;
					await misskeyApi('following/delete', { userId: target.id });
				} else if (pending.value) {
					const { canceled } = await os.confirm({ type: 'question', text: i18n.tsx.cancelFollowRequestConfirm({ name: target.name || target.username }) });
					if (canceled) return;
					await misskeyApi('following/requests/cancel', { userId: target.id });
					pending.value = false;
				} else {
					if (prefer.s.alwaysConfirmFollow) {
						const { canceled } = await os.confirm({ type: 'question', text: i18n.tsx.followConfirm({ name: target.name || target.username }) });
						if (canceled) return;
					}
					await misskeyApi('following/create', { userId: target.id, withReplies: prefer.s.defaultFollowWithReplies });
					pending.value = true;
					onUpdate?.({ ...target, withReplies: prefer.s.defaultFollowWithReplies });
					if ($i) {
						claimAchievement('following1');
						if ($i.followingCount >= 10) claimAchievement('following10');
						if ($i.followingCount >= 50) claimAchievement('following50');
						if ($i.followingCount >= 100) claimAchievement('following100');
						if ($i.followingCount >= 300) claimAchievement('following300');
					}
				}
			} catch (error) {
				console.error(error);
			} finally {
				wait.value = false;
			}
		},
	};
	entries.set(user.id, entry);
	ensureConnection();
	if (user.isFollowing == null && $i) void misskeyApi('users/show', { userId: user.id }).then(applyFollowState);
	return entry;
}

export function followButtonController(user: Misskey.entities.UserDetailed): FollowButtonController {
	return entryFor(user);
}
