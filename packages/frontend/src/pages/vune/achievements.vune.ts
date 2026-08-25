/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkAchievements from '@/components/MkAchievements.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { user: Misskey.entities.User };
export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '1200px' } },
			VueComponent(MkAchievements, { user: props.user }),
		),
	})
);
