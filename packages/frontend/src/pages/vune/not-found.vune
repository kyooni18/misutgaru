/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element } from 'vune-ui';
import MkResult from '@/components/global/MkResult.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

export default createVuneComponent(() =>
	Element('div', { className: 'mk-vune-not-found' },
		VueComponent(MkResult, { type: 'notFound', text: i18n.ts.notFoundDescription }),
	)
);
