/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import MkFeaturedPhotos from '@/components/MkFeaturedPhotos.vue';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import misskeysvg from '/client-assets/misskey.svg';
import { instance as meta } from '@/instance.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

export default createVuneComponent(() => {
	if (!meta) return Group() {};
	return Element('div', { className: 'mk-vune-welcome-simple' },
		VueComponent(MkFeaturedPhotos, { class: 'mk-vune-welcome-simple__bg' }),
		Element('div', { className: 'mk-vune-welcome-simple__logo' },
			Element('div', { className: 'mk-vune-welcome-simple__powered' }, 'Powered by'),
			Element('img', { className: 'mk-vune-welcome-simple__misskey', src: misskeysvg }),
		),
		Element('div', { className: 'mk-vune-welcome-simple__contents' }, VueComponent(MkVisitorDashboard)),
	);
});
