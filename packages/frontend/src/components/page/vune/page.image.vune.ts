/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import * as Misskey from 'misskey-js';
import MkMediaList from '@/components/MkMediaList.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/components/vune/misskey-vune.scss';

type Props = {
	block: Extract<Misskey.entities.PageBlock, { type: 'image' }>;
	page: Misskey.entities.Page;
};

export default createVuneComponent<Props>((props) => {
	const image = props.page.attachedFiles.find(file => file.id === props.block.fileId) ?? null;
	return Group() {
		Element('div', { className: 'mk-vune-page-image' },
			image ? VueComponent(MkMediaList, {
				mediaList: [image],
				user: props.page.user,
				class: 'mk-vune-page-image__media-list',
			}) : null,
		)
	}
});
