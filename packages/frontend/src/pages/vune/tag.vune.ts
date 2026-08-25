/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import MkButton from '@/components/MkButton.vue';
import type { PageHeaderItem } from '@/types/page-header.js';
import type { IPaginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';
import MaterialSurface from '@/vune/MaterialSurface.vune.js';
import { Material } from '@/vune/material.js';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = {
	paginator: IPaginator;
	headerActions?: PageHeaderItem[];
	headerTabs?: unknown[];
	signedIn?: boolean;
	onPost?: () => void;
};

export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, { actions: props.headerActions ?? [], tabs: props.headerTabs ?? [] }, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px' } },
			VueComponent(MkNotesTimeline, { paginator: props.paginator }),
		),
		footer: () => vuneBoolean(props.signedIn) ? Group() {
			MaterialSurface(Material.bar) {
				Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px', '--MI_SPACER-min': '16px', '--MI_SPACER-max': '16px' } },
					VueComponent(MkButton, {
						rounded: true,
						primary: true,
						class: 'mk-vune-tag-post-button',
						onClick: () => props.onPost?.(),
					}, {
						default: () => Group() {
							Element('i', { className: 'ti ti-pencil' })
							Text(i18n.ts.postToHashtag)
						},
					})
				)
			}.className('mk-vune-tag-footer')
		} : null,
	})
);
