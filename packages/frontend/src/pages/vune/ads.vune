/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkAd from '@/components/global/MkAd.vue';
import MkResult from '@/components/global/MkResult.vue';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

definePage(() => ({ title: i18n.ts.ads, icon: 'ti ti-ad' }));
export default createVuneComponent(() =>
	VueComponent(PageWithHeader, {}, { default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '500px' } },
		instance.ads.length > 0 ? Group() {
			ForEach(instance.ads, key: (ad: any) => ad.id) { ad in VueComponent(MkAd, { specify: ad }) }
		}.className('_gaps') : VueComponent(MkResult, { type: 'empty' }),
	) })
);
