/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import * as Misskey from 'misskey-js';
import XBlock from '@/components/page/page.block.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/components/vune/misskey-vune.scss';

type Props = {
	page: Misskey.entities.Page;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		Element('div', {
			className: [
				'_gaps',
				props.page.alignCenter ? 'mk-vune-page__center' : null,
				props.page.font === 'serif' ? 'mk-vune-page__serif' : null,
			],
		},
			ForEach(props.page.content ?? [], key: (child) => child.id) { child in
				VueComponent(XBlock, { page: props.page, block: child, h: 2 })
			},
		)
	}
);
