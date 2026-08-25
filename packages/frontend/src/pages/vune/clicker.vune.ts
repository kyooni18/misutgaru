/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element } from 'vune-ui';
import MkClickerGame from '@/components/MkClickerGame.vue';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import { definePage } from '@/page.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

definePage(() => ({ title: '🍪👈', icon: 'ti ti-cookie' }));
export default createVuneComponent(() =>
	VueComponent(PageWithHeader, {}, { default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px' } }, VueComponent(MkClickerGame)) })
);
