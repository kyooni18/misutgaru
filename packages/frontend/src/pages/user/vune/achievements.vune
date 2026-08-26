/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkAchievements from '@/components/MkAchievements.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { user: Misskey.entities.User; withDescription: boolean };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '1200px' } },
		VueComponent(MkAchievements, { user: props.user, withLocked: false, withDescription: props.withDescription }),
	)
);
