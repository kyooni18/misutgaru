/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import * as Misskey from 'misskey-js';
import I18n from '@/components/global/I18n.vue';
import MkA from '@/components/global/MkA.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/components/vune/misskey-vune.scss';

type Props = {
	block: Misskey.entities.PageBlock;
	page: Misskey.entities.Page;
};

export default createVuneComponent<Props>(() =>
	Group() {
		Element('div', { className: 'mk-vune-page-dynamic' },
			Element('div', { className: 'mk-vune-page-dynamic__heading' },
				Element('i', { className: 'ti ti-dice-5' }),
				` ${i18n.ts._pages.blocks.dynamic}`,
			),
			VueComponent(I18n, {
				src: i18n.ts._pages.blocks.dynamicDescription,
				tag: 'div',
				class: 'mk-vune-page-dynamic__text',
			}, {
				play: () => VueComponent(MkA, { to: '/play', class: '_link' }, {
					default: () => Text('Play'),
				}),
			}),
		)
	}
);
