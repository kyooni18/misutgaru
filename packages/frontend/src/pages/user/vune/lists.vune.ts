/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import MkPagination from '@/components/MkPagination.vue';
import MkStickyContainer from '@/components/global/MkStickyContainer.vue';
import MkAvatars from '@/components/MkAvatars.vue';
import MkA from '@/components/global/MkA.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkStickyContainer, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } },
			Element('div', {},
				VueComponent(MkPagination, { paginator: props.paginator, withControl: true }, {
					default: (slotProps: any) => Group() {
						ForEach(slotProps.items ?? [], key: (list: any) => list.id) { list in
							VueComponent(MkA, { class: '_panel mk-vune-user-list-card', to: `/list/${list.id}` }, {
								default: () => Group() {
									Element('div', {}, Text(list.name))
									if (list.userIds != null) { VueComponent(MkAvatars, { userIds: list.userIds }) }
								},
							})
						}
					},
				}),
			),
		),
	})
);
