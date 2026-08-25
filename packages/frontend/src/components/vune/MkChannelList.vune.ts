/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group } from 'vune-ui';
import * as Misskey from 'misskey-js';
import type { IPaginator, ExtractorFunction } from '@/utility/paginator.js';
import MkChannelPreview from '@/components/MkChannelPreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkResult from '@/components/global/MkResult.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator; noGap?: boolean; extractor?: ExtractorFunction<any, Misskey.entities.Channel> };
export default createVuneComponent<Props>((props) => {
	const extractor = props.extractor ?? ((item: any) => item as Misskey.entities.Channel);
	return VueComponent(MkPagination, { paginator: props.paginator }, {
		empty: () => VueComponent(MkResult, { type: 'empty' }),
		default: (slotProps: any) => Group() {
			ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in
				VueComponent(MkChannelPreview, { class: '_margin', channel: extractor(item) })
			}
		},
	});
});
