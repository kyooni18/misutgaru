/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text, VStack } from 'vune-ui';
import I18n from '@/components/global/I18n.vue';
import { i18n } from '@/i18n.js';
import { basicTimelineIconClass, basicTimelineTypes } from '@/timelines.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

export default createVuneComponent(() =>
	VStack(spacing: 0) {
		Element('div', { style: { textAlign: 'center', padding: '0 16px' } }, i18n.ts._initialTutorial._timeline.description1)
		Element('div', { className: '_gaps_s' }, Group() {
			ForEach(basicTimelineTypes, key: (tl: string) => tl) { tl in
				Element('div', {},
					Element('i', { className: basicTimelineIconClass(tl as any) }),
					Text(' '), Element('b', {}, (i18n.ts._timelines as any)[tl]),
					Text(' … ' + ((i18n.ts._initialTutorial._timeline as any)[tl] ?? '')),
				)
			}
		})
		Element('div', { className: '_gaps_s' },
			Element('div', {}, i18n.ts._initialTutorial._timeline.description2),
			Element('img', { className: 'mk-vune-tutorial-image', src: '/client-assets/tutorial/timeline_tab.png' }),
		)
		Element('div', { className: 'mk-vune-tutorial-divider' })
		VueComponent(I18n, { src: i18n.ts._initialTutorial._timeline.description3, tag: 'div', style: { padding: '0 16px' } }, {
			link: () => Element('a', { href: 'https://misskey-hub.net/docs/for-users/features/timeline/', target: '_blank', className: '_link', rel: 'noopener noreferrer' }, i18n.ts.help),
		})
	}.className('_gaps')
);
