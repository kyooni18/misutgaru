/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkA from '@/components/global/MkA.vue';
import MkPagination from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } },
	VueComponent(MkPagination, { paginator: props.paginator, withControl: true }, { default: (slotProps: any) => Group() {
		ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in
			VueComponent(MkA, { to: `/clips/${item.id}`, class: '_panel _margin mk-vune-clip' }, { default: () => Group() {
				Element('b', {}, item.name)
				if (item.description) { Element('div', { className: 'mk-vune-clip__description' }, item.description) }
			} })
		}
	} }),
));
