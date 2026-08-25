/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group, Text } from 'vune-ui';
import XMessage from '@/pages/chat/XMessage.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkPagination from '@/components/MkPagination.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) => Group() {
	VueComponent(MkInfo, {}, { default: () => Text(i18n.ts._fileViewer.thisPageCanBeSeenFromTheAuthor) })
	VueComponent(MkPagination, { paginator: props.paginator }, { default: (slotProps: any) => Group() {
		ForEach(slotProps.items ?? [], key: (item: any) => item.id) { item in VueComponent(XMessage, { message: item, isSearchResult: true }) }
	} })
}.className('_gaps'));
