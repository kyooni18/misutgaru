/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkNoteMediaGrid from '@/components/MkNoteMediaGrid.vue';
import MkPagination from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '1100px' } },
		Element('div', { className: 'mk-vune-user-files-root' },
			VueComponent(MkPagination, { paginator: props.paginator, withControl: true }, {
				default: (slotProps: any) => Element('div', { className: 'mk-vune-user-files-stream' }, Group() {
					ForEach(slotProps.items ?? [], key: (note: any) => note.id) { note in
						VueComponent(MkNoteMediaGrid, { note: note, square: true })
					}
				}),
			}),
		),
	)
);
