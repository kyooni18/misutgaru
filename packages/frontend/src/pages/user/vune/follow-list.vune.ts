/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkUserInfo from '@/components/MkUserInfo.vue';
import MkPagination from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { type: 'following' | 'followers'; followingPaginator: IPaginator; followersPaginator: IPaginator };
export default createVuneComponent<Props>((props) => {
	const paginator = props.type === 'following' ? props.followingPaginator : props.followersPaginator;
	return Element('div', {},
		VueComponent(MkPagination, { paginator, withControl: true }, {
			default: (slotProps: any) => Group() {
				Element('div', { className: 'mk-vune-follow-users' }, Group() {
					ForEach(slotProps.items ?? [], key: (item: any) => (props.type === 'following' ? item.followee : item.follower)?.id ?? item.id) { item in
						VueComponent(MkUserInfo, { user: props.type === 'following' ? item.followee : item.follower })
					}
				})
			},
		}),
	);
});
