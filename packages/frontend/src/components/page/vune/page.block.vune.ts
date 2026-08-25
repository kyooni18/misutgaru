/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XText from './page.text.vune.js';
import XSection from './page.section.vune.js';
import XImage from './page.image.vune.js';
import XNote from '../page.note.vue';
import XDynamic from './page.dynamic.vune.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { block: Misskey.entities.PageBlock; h: number; page: Misskey.entities.Page };
export default createVuneComponent<Props>((props) => {
	const common = { key: props.block.id, page: props.page, block: props.block, h: props.h };
	switch (props.block.type) {
		case 'text': return XText(common as any) as any;
		case 'section': return XSection(common as any) as any;
		case 'image': return XImage(common as any) as any;
		case 'note': return VueComponent(XNote, common);
		case 'button': case 'if': case 'textarea': case 'post': case 'canvas': case 'numberInput': case 'textInput': case 'switch': case 'radioButton': case 'counter':
			return XDynamic(common as any) as any;
		default: return Group() {};
	}
});
