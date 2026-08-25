/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkSuspense from '@/components/global/MkSuspense.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import bytes from '@/filters/bytes.js';
import number from '@/filters/number.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type TableEntry = [string, { size: number; count: number }];
type Props = { databasePromiseFactory: () => Promise<TableEntry[]> };
export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '800px', '--MI_SPACER-min': '16px', '--MI_SPACER-max': '32px' } },
			VueComponent(MkSuspense, { p: props.databasePromiseFactory }, {
				default: (slotProps: any) => Group() {
					ForEach(slotProps.result ?? [], key: (table: TableEntry) => table[0]) { table in
						VueComponent(MkKeyValue, { oneline: true, style: { margin: '1em 0' } }, {
							key: () => Text(table[0]),
							value: () => Text(`${bytes(table[1].size)} (${number(table[1].count)} recs)`),
						})
					}
				},
			}),
		),
	})
);
