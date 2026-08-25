/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XBlock from './page.block.vune.js';
import { createVuneComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { block: Extract<Misskey.entities.PageBlock, { type: 'section' }>; h: number; page: Misskey.entities.Page };
export default createVuneComponent<Props>((props) => {
	const level = Math.max(1, Math.min(6, props.h));
	const headingClass = level === 2 ? 'mk-vune-page-section__h2' : level === 3 ? 'mk-vune-page-section__h3' : level === 4 ? 'mk-vune-page-section__h4' : '';
	return Element('section', {},
		Element(`h${level}`, { className: headingClass }, props.block.title),
		Group() {
			ForEach(props.block.children, key: (child: Misskey.entities.PageBlock) => child.id) { child in
				XBlock({ page: props.page, block: child, h: props.h + 1 } as any)
			}
		}.className('_gaps'),
	);
});
