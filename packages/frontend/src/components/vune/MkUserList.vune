/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group } from 'vune-ui';
import * as Misskey from 'misskey-js';
import type { IPaginator, ExtractorFunction } from '@/utility/paginator.js';
import MkUserInfo from '@/components/MkUserInfo.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkResult from '@/components/global/MkResult.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { paginator: IPaginator; noGap?: boolean; extractor?: ExtractorFunction<any, Misskey.entities.UserDetailed> };
export default createVuneComponent<Props>((props) => {
	const extractor = props.extractor ?? ((item: any) => item as Misskey.entities.UserDetailed);
	return VueComponent(MkPagination, { paginator: props.paginator }, {
		empty: () => VueComponent(MkResult, { type: 'empty', text: i18n.ts.noUsers }),
		default: (slotProps: any) => Group() {
			Group() {
				ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in
					VueComponent(MkUserInfo, { user: extractor(item) })
				}
			}.className('mk-vune-user-list')
		},
	});
});
