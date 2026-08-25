/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import MkAnimBg from '@/components/MkAnimBg.vue';
import { createVuneComponent, VueComponent, VueSlot } from '@/vune/vue.js';
import '@/components/vune/misskey-vune.scss';

export default createVuneComponent((_props, slots) =>
	Group() {
		Element('div', null,
			VueComponent(MkAnimBg, { style: { position: 'absolute' } }),
			Element('div', { className: ['_pageScrollable', 'mk-vune-page-anim-bg__body'] },
				VueSlot(slots.default),
			),
		)
	}
);
