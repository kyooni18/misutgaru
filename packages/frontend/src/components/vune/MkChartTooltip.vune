/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, HStack, Text } from 'vune-ui';
import MkTooltip from '@/components/MkTooltip.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type SeriesItem = { backgroundColor: string; borderColor: string; text: string };
type Props = { showing: boolean; x: number; y: number; title?: string | null; series?: SeriesItem[] | null; onClosed?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkTooltip, {
		showing: props.showing, x: props.x, y: props.y, maxWidth: 340, direction: 'top', innerMargin: 16,
		onClosed: () => props.onClosed?.(),
	}, {
		default: () => Group() {
			if (props.title || props.series) {
				Group() {
					if (props.title) { Element('div', { className: 'mk-vune-tooltip-title' }, props.title) }
					if (props.series) {
						ForEach(props.series, key: (item: SeriesItem, index: number) => `${index}:${item.text}`) { item in
							HStack(alignment: 'center', spacing: 0) {
								Element('span', { className: 'mk-vune-tooltip-color', style: { background: item.backgroundColor, borderColor: item.borderColor } })
								Text(item.text)
							}
						}
					}
				}
			}
		},
	})
);
