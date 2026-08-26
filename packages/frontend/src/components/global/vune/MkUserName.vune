/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import * as Misskey from 'misskey-js';
import Mfm from '@/components/global/MkMfm.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = {
	user: Misskey.entities.User;
	nowrap?: boolean;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		VueComponent(Mfm, {
			text: props.user.name ?? props.user.username,
			author: props.user,
			plain: true,
			nowrap: props.nowrap ?? true,
			emojiUrls: props.user.emojis,
		})
	}
);
