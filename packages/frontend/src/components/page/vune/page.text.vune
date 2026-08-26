/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group } from 'vune-ui';
import * as mfm from 'mfm-js';
import type * as Misskey from 'misskey-js';
import Mfm from '@/components/global/MkMfm.js';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';
import { isEnabledUrlPreview } from '@/utility/url-preview.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { block: Extract<Misskey.entities.PageBlock, { type: 'text' }>; page: Misskey.entities.Page };
export default createVuneComponent<Props>((props) => {
	const text = props.block.text ?? '';
	const urls = text ? extractUrlFromMfm(mfm.parse(text)) : [];
	return Group() {
		VueComponent(Mfm as any, { text, isNote: false })
		if (isEnabledUrlPreview) {
			Group() {
				ForEach(urls, key: (url: string) => url) { url in
					VueComponent(MkUrlPreview, { url })
				}
			}.className('_gaps_s')
		}
	}.className(['_gaps', 'mk-vune-page-text']);
});
