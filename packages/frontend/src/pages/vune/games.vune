/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import MkA from '@/components/global/MkA.vue';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import { definePage } from '@/page.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

definePage(() => ({ title: 'Misskey Games', icon: 'ti ti-device-gamepad' }));
const game = (to: string, src: string) => Group() {
	VueComponent(MkA, { to }, { default: () => Element('img', { src, style: { display: 'block', maxWidth: '100%', maxHeight: '200px', margin: 'auto' } }) })
}.className(['_panel', 'mk-vune-games-link']);
export default createVuneComponent(() =>
	VueComponent(PageWithHeader, {}, { default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px' } },
		Group() { game('/bubble-game', '/client-assets/drop-and-fusion/logo.png'); game('/reversi', '/client-assets/reversi/logo.png') }.className('_gaps'),
	) })
);
