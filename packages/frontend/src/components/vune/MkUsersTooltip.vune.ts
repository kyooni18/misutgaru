/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkTooltip from '@/components/MkTooltip.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { showing: boolean; users: Misskey.entities.UserLite[]; count: number; anchorElement: HTMLElement; onClosed?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkTooltip, { showing: props.showing, anchorElement: props.anchorElement, maxWidth: 250, onClosed: () => props.onClosed?.() }, {
		default: () => Group() {
			ForEach(props.users, key: (user: Misskey.entities.UserLite) => user.id) { user in
				Element('div', { className: 'mk-vune-users-tooltip__user' },
					VueComponent(MkAvatar, { class: 'mk-vune-users-tooltip__avatar', user }),
					VueComponent(MkUserName, { user, nowrap: true }),
				)
			}
			if (props.users.length < props.count) { Text(`+${props.count - props.users.length}`) }
		}.className('mk-vune-users-tooltip'),
	})
);
