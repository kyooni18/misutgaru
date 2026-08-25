/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import XColumn from '../column.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import type { Column } from '@/deck.js';
import type { IPaginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { column: Column; isStacked: boolean; paginator: IPaginator };
export default createVuneComponent<Props>((props) =>
	VueComponent(XColumn, {
		column: props.column,
		isStacked: props.isStacked,
		refresher: () => props.paginator.reload().then(() => undefined),
	}, {
		header: () => Group() {
			Element('i', { className: 'ti ti-at', style: { marginRight: '8px' } })
			Text(props.column.name || i18n.ts._deck._columns.mentions)
		},
		default: () => VueComponent(MkNotesTimeline, { paginator: props.paginator }),
	})
);
