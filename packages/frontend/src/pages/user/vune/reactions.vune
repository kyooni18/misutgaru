/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkTime from '@/components/global/MkTime.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator; user: Misskey.entities.User };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } },
		VueComponent(MkPagination, { paginator: props.paginator }, {
			default: (slotProps: any) => Group() {
				ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in
					Element('div', { className: '_panel _margin' },
						Element('div', { className: 'mk-vune-reaction-header' },
							VueComponent(MkAvatar, { class: 'mk-vune-reaction-avatar', user: props.user }),
							VueComponent(MkReactionIcon, { class: 'mk-vune-reaction-icon', reaction: item.type, noStyle: true }),
							VueComponent(MkTime, { class: 'mk-vune-reaction-created', time: item.createdAt }),
						),
						VueComponent(MkNote, { key: item.id, note: item.note }),
					)
				}
			},
		}),
	)
);
