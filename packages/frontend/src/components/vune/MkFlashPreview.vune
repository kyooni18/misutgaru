/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkA from '@/components/global/MkA.vue';
import Mfm from '@/components/global/MkMfm.js';
import { userName } from '@/filters/user.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { flash: Misskey.entities.Flash };
export default createVuneComponent<Props>((props) => {
	const flash = props.flash;
	return VueComponent(MkA, {
		to: `/play/${flash.id}`,
		class: ['_panel', 'mk-vune-flash', flash.visibility === 'private' ? 'mk-vune-flash--private' : ''],
	}, {
		default: () => Element('article', {},
			Element('header', {}, Element('h1', { title: flash.title }, flash.title)),
			flash.summary ? Element('p', { className: 'mk-vune-flash__summary', title: flash.summary },
				VueComponent(Mfm as any, { class: 'summaryMfm', text: flash.summary, plain: true, nowrap: true }),
			) : null,
			Element('footer', {},
				Element('img', { className: 'mk-vune-flash__avatar', src: flash.user.avatarUrl ?? '' }),
				Element('p', { className: 'mk-vune-flash__user' }, userName(flash.user)),
			),
		),
	});
});
