/* SPDX-License-Identifier: AGPL-3.0-only */
import { Button, Element, Group, HStack, Text } from 'vune-ui';
import MkA from '@/components/global/MkA.vue';
import { i18n } from '@/i18n.js';
import { themeManager } from '@/theme.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

export default createVuneComponent(() =>
	HStack(alignment: 'center', spacing: 0) {
		Element('i', { className: 'ti ti-info-circle mk-vune-bar__icon' })
		Text(i18n.ts.previewingTheme).className('mk-vune-bar__title')
		HStack(alignment: 'center', spacing: 4) {
			Button(i18n.ts.previewingThemeRestore) { themeManager.clearPreview() }.className(['_textButton','mk-vune-bar__button'])
			Text('|')
			VueComponent(MkA, { to: '/settings/theme', class: '_textButton mk-vune-bar__button' }, { default: () => Text(i18n.ts.settings) })
		}.className('mk-vune-bar__body')
	}.className(['mk-vune-bar','mk-vune-bar--accent'])
);
