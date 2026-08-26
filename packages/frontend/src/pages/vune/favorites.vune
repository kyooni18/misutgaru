/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import MkResult from '@/components/global/MkResult.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px' } },
			VueComponent(MkPagination, { paginator: props.paginator }, {
				empty: () => VueComponent(MkResult, { type: 'empty', text: i18n.ts.noNotes }),
				default: (slotProps: any) => Group() {
					ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in
						VueComponent(MkNote, { note: item.note, class: 'mk-vune-favorite-note' })
					}
				},
			}),
		),
	})
);
