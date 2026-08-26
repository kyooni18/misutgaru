/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkContainer from '@/components/MkContainer.vue';
import MkChart from '@/components/MkChart.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { user: Misskey.entities.User; limit: number; chartSrc: 'per-user-notes' | 'per-user-pv'; onMenu?: (ev: PointerEvent) => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkContainer, {}, {
		icon: () => Element('i', { className: 'ti ti-chart-line' }),
		header: () => Text(i18n.ts.activity),
		func: (slotProps: any) => Element('button', {
			className: ['_button', slotProps.buttonStyleClass],
			onClick: (ev: PointerEvent) => props.onMenu?.(ev),
		}, Element('i', { className: 'ti ti-dots' })),
		default: () => Element('div', { style: { padding: '8px' } },
			VueComponent(MkChart, {
				src: props.chartSrc,
				args: { user: props.user, withoutAll: true },
				span: 'day', limit: props.limit, bar: true, stacked: true, detailed: false, aspectRatio: 5,
			}),
		),
	})
);
