/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkA from '@/components/global/MkA.vue';
import MediaImage from '@/components/MkMediaImage.vue';
import { userName } from '@/filters/user.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { page: Misskey.entities.Page };
export default createVuneComponent<Props>((props) => {
	const page = props.page;
	const summary = page.summary ? (page.summary.length > 85 ? page.summary.slice(0, 85) + '…' : page.summary) : null;
	return VueComponent(MkA, { to: `/@${page.user.username}/pages/${page.name}`, class: 'mk-vune-page-preview' }, {
		default: () => Group() {
			if (page.eyeCatchingImage) {
				Element('div', { className: 'mk-vune-page-preview__thumb' },
					VueComponent(MediaImage, { image: page.eyeCatchingImage, disableImageLink: true, controls: false, cover: true, style: { width: '100%', height: '100%' } }),
				)
			}
			Element('article', {},
				Element('header', {}, Element('h1', { title: page.title }, page.title)),
				summary ? Element('p', { className: 'mk-vune-page-preview__summary', title: page.summary ?? '' }, summary) : null,
				Element('footer', {},
					page.user.avatarUrl ? Element('img', { className: 'mk-vune-page-preview__avatar', src: page.user.avatarUrl }) : null,
					Element('p', { className: 'mk-vune-page-preview__user' }, userName(page.user)),
				),
			)
		},
	});
});
