/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkPagePreview from '@/components/MkPagePreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } }, VueComponent(MkPagination, { paginator: props.paginator, withControl: true }, {
		default: (slotProps: any) => Group() {
			ForEach(slotProps.items ?? [], key: (page: any) => page.id) { page in
				VueComponent(MkPagePreview, { page: page, class: '_margin' })
			}
		},
	}))
);
