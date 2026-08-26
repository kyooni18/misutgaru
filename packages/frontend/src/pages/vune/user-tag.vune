/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element } from 'vune-ui';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkUserList from '@/components/MkUserList.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '1200px' } },
			Element('div', { className: '_gaps_s' }, VueComponent(MkUserList, { paginator: props.paginator })),
		),
	})
);
